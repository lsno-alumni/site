-- ============================================================
-- Migration 61 — QUESTIONS AUX ANCIENS, suite (décision du 26/09)
--   8.  Pièce jointe à une question : une photo (réduite) ou un PDF, dans le
--       bucket public « medias » (dossier de l'auteur), gardée 14 jours puis
--       purgée (la question reste, marquée « pièce expirée »).
--       ⚠ AVANT : dans Storage, ajouter application/pdf aux types acceptés
--         par le bucket « medias » (il n'accepte que image/* et video/*).
--   9.  Recherche par mots du titre ou des détails (liste_questions, p_q).
--   12. Fermeture automatique : une question résolue sans nouvelle réponse
--       depuis 30 jours passe en lecture seule ; la rouvrir la libère.
--   Rejouable. Se termine par ses GRANT explicites.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Colonnes
-- ------------------------------------------------------------
alter table questions add column if not exists fichier_chemin    text;
alter table questions add column if not exists fichier_type      text check (fichier_type is null or fichier_type in ('photo', 'pdf'));
alter table questions add column if not exists fichier_nom       text;
alter table questions add column if not exists fichier_taille    integer;
alter table questions add column if not exists fichier_expire_le timestamptz;
alter table questions add column if not exists fichier_expiree   boolean not null default false;
alter table questions add column if not exists fermee            boolean not null default false;

create or replace function questions_avant_insert() returns trigger
language plpgsql as $$
begin
  new.titre := btrim(new.titre); new.details := btrim(coalesce(new.details, ''));
  new.theme := nullif(btrim(coalesce(new.theme, '')), '');
  if new.fichier_chemin is not null and new.fichier_expire_le is null then
    new.fichier_expire_le := now() + interval '14 days';
  end if;
  return new;
end $$;

create or replace function questions_avant_update() returns trigger
language plpgsql as $$
begin
  new.maj_le := now();
  if auth.uid() = old.auteur and not est_moderateur() then
    new.masquee := old.masquee; new.masquee_par := old.masquee_par;
  end if;
  -- rouvrir libère une question fermée
  if old.resolue and not new.resolue then new.fermee := false; end if;
  return new;
end $$;

-- une question fermée ne reçoit plus de réponse
drop policy if exists reponses_insertion on reponses;
create policy reponses_insertion on reponses
  for insert to authenticated
  with check (mon_statut() = 'valide' and auteur = auth.uid()
              and exists (select 1 from questions q where q.id = question_id and not q.masquee and not q.fermee));

-- ------------------------------------------------------------
-- 2. Fermeture automatique (tous les jours à 5 h)
-- ------------------------------------------------------------
create or replace function fermer_questions() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update questions q set fermee = true
   where q.resolue and not q.fermee
     and q.maj_le < now() - interval '30 days'
     and not exists (select 1 from reponses r where r.question_id = q.id and r.cree_le > now() - interval '30 days');
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function fermer_questions() from public, anon, authenticated;
select cron.schedule('fermer-questions', '0 5 * * *', $$select fermer_questions()$$);

-- ------------------------------------------------------------
-- 3. Pièces : purge à 14 jours, et suppression avec la question
-- ------------------------------------------------------------
create or replace function purge_pieces() returns integer
language plpgsql security definer set search_path = public as $$
declare cle text; v record; n integer := 0;
begin
  select decrypted_secret into cle from vault.decrypted_secrets where name = 'service_role_key';
  for v in
    select id, fichier_chemin from messages
    where fichier_chemin is not null and not fichier_expiree and fichier_type <> 'lien'
      and fichier_expire_le is not null and fichier_expire_le < now()
  loop
    if cle is not null then
      perform net.http_delete(
        url     := 'https://pdjbqdwurwgxzghehldr.supabase.co/storage/v1/object/pieces/' || v.fichier_chemin,
        headers := jsonb_build_object('Authorization', 'Bearer ' || cle, 'apikey', cle));
    end if;
    update messages set fichier_chemin = null, fichier_expiree = true where id = v.id;
    n := n + 1;
  end loop;
  for v in
    select id, fichier_chemin from questions
    where fichier_chemin is not null and not fichier_expiree
      and fichier_expire_le is not null and fichier_expire_le < now()
  loop
    if cle is not null then
      perform net.http_delete(
        url     := 'https://pdjbqdwurwgxzghehldr.supabase.co/storage/v1/object/medias/' || v.fichier_chemin,
        headers := jsonb_build_object('Authorization', 'Bearer ' || cle, 'apikey', cle));
    end if;
    update questions set fichier_chemin = null, fichier_expiree = true where id = v.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function purge_pieces() from public, anon, authenticated;

create or replace function apres_suppression_question() returns trigger
language plpgsql security definer set search_path = public as $$
declare cle text;
begin
  if old.fichier_chemin is null or old.fichier_expiree then return old; end if;
  select decrypted_secret into cle from vault.decrypted_secrets where name = 'service_role_key';
  if cle is not null then
    perform net.http_delete(
      url     := 'https://pdjbqdwurwgxzghehldr.supabase.co/storage/v1/object/medias/' || old.fichier_chemin,
      headers := jsonb_build_object('Authorization', 'Bearer ' || cle, 'apikey', cle));
  end if;
  return old;
exception when others then
  return old;
end $$;
drop trigger if exists questions_apres_delete_piece on questions;
create trigger questions_apres_delete_piece after delete on questions
  for each row execute function apres_suppression_question();

-- ------------------------------------------------------------
-- 4. Lectures : recherche (p_q), pièce, fermeture
-- ------------------------------------------------------------
drop function if exists liste_questions(text, text, integer, timestamptz);
create or replace function liste_questions(p_filtre text default 'toutes', p_theme text default null,
                                           p_limite integer default 20, p_avant timestamptz default null,
                                           p_q text default null)
returns json language sql stable security invoker set search_path = public as $$
  select coalesce(json_agg(json_build_object(
    'id', q.id, 'titre', q.titre, 'details', left(q.details, 160), 'theme', q.theme, 'domaine', q.domaine,
    'anonyme', q.anonyme, 'resolue', q.resolue, 'fermee', q.fermee, 'masquee', q.masquee, 'cree_le', q.cree_le,
    'fichier_type', q.fichier_type,
    'auteur', auteur_question_json(q.auteur, q.anonyme),
    'nb_reponses', (select count(*) from reponses r where r.question_id = q.id and not r.masquee),
    'bravos', (select count(*) from reactions x where x.cible_type = 'question' and x.cible_id = q.id::text),
    'jai_bravo', exists (select 1 from reactions x where x.cible_type = 'question' and x.cible_id = q.id::text and x.membre = auth.uid())
  ) order by q.cree_le desc), '[]'::json)
  from (
    select * from questions q
    where (p_avant is null or q.cree_le < p_avant)
      and (p_theme is null or q.theme = p_theme)
      and (p_q is null or char_length(btrim(p_q)) < 2
           or q.titre ilike '%' || btrim(p_q) || '%' or q.details ilike '%' || btrim(p_q) || '%')
      and (p_filtre = 'toutes'
           or (p_filtre = 'sans_reponse' and not q.resolue and not exists (select 1 from reponses r where r.question_id = q.id and not r.masquee))
           or (p_filtre = 'resolues' and q.resolue)
           or (p_filtre = 'ouvertes' and not q.resolue)
           or (p_filtre = 'miennes' and q.auteur = auth.uid()))
    order by q.cree_le desc
    limit least(coalesce(p_limite, 20), 50)
  ) q
$$;
revoke all on function liste_questions(text, text, integer, timestamptz, text) from public, anon;
grant execute on function liste_questions(text, text, integer, timestamptz, text) to authenticated;

create or replace function lire_question(p_id bigint) returns json
language sql stable security invoker set search_path = public as $$
  select json_build_object(
    'id', q.id, 'titre', q.titre, 'details', q.details, 'theme', q.theme, 'domaine', q.domaine,
    'anonyme', q.anonyme, 'resolue', q.resolue, 'fermee', q.fermee, 'meilleure_reponse', q.meilleure_reponse, 'masquee', q.masquee,
    'cree_le', q.cree_le, 'est_moi', q.auteur = auth.uid(),
    'fichier_chemin', q.fichier_chemin, 'fichier_type', q.fichier_type, 'fichier_nom', q.fichier_nom,
    'fichier_taille', q.fichier_taille, 'fichier_expiree', q.fichier_expiree,
    'auteur', auteur_question_json(q.auteur, q.anonyme),
    'bravos', (select count(*) from reactions x where x.cible_type = 'question' and x.cible_id = q.id::text),
    'jai_bravo', exists (select 1 from reactions x where x.cible_type = 'question' and x.cible_id = q.id::text and x.membre = auth.uid()),
    'reponses', (select coalesce(json_agg(json_build_object(
        'id', r.id, 'texte', r.texte, 'masquee', r.masquee, 'cree_le', r.cree_le, 'modifie_le', r.modifie_le,
        'auteur', json_build_object('id', a.id, 'prenom', a.prenom, 'nom', a.nom, 'photo_url', a.photo_url,
                                    'promo', (select numero from promotions where id = a.promotion_id),
                                    'situation', a.situation, 'statut_titre', a.statut_titre),
        'bravos', (select count(*) from reactions x where x.cible_type = 'reponse' and x.cible_id = r.id::text),
        'jai_bravo', exists (select 1 from reactions x where x.cible_type = 'reponse' and x.cible_id = r.id::text and x.membre = auth.uid())
      ) order by (r.id = q.meilleure_reponse) desc, r.cree_le), '[]'::json)
      from reponses r join profiles a on a.id = r.auteur where r.question_id = q.id)
  )
  from questions q where q.id = p_id
$$;

-- Vérifications (une instruction à la fois dans l'éditeur SQL) :
--   select pronargs from pg_proc where proname = 'liste_questions';   -- 5 (une seule ligne)
--   select jobname from cron.job where jobname = 'fermer-questions';
--   select column_name from information_schema.columns where table_name = 'questions' and column_name in ('fichier_chemin', 'fermee');  -- 2
