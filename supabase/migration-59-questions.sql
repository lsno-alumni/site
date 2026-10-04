-- ============================================================
-- Migration 59 — QUESTIONS AUX ANCIENS (chantier « réseau social », brique 3)
--   Un membre validé (souvent un élève ou un jeune ancien) pose une
--   question, à visage découvert ou anonyme (l'auteur reste connu des
--   modérateurs). Les anciens répondent. L'auteur marque la meilleure
--   réponse et la question devient « résolue ». Bravo sur les réponses
--   (table reactions, cible « reponse »), signalement et modération comme
--   le Fil (journalisé). Push : nouvelle question → les membres qui
--   « répondent aux cadets » sur ce sujet (famille « fil », regroupée) ;
--   réponse → l'auteur de la question et ceux qui ont déjà répondu ;
--   meilleure réponse → son auteur (famille « mes_demandes »).
--   Rejouable. Se termine par ses GRANT explicites.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tables
-- ------------------------------------------------------------
create table if not exists questions (
  id                bigserial primary key,
  auteur            uuid not null references profiles(id) on delete cascade,
  titre             text not null check (char_length(btrim(titre)) between 5 and 140),
  details           text not null default '' check (char_length(details) <= 2000),
  theme             text,                       -- un des thèmes des conseils, ou libre
  domaine           text,                       -- clé de domaine, facultatif
  anonyme           boolean not null default false,
  resolue           boolean not null default false,
  meilleure_reponse bigint,                     -- référence posée plus bas (table reponses)
  masquee           boolean not null default false,
  masquee_par       uuid references profiles(id),
  cree_le           timestamptz not null default now(),
  maj_le            timestamptz not null default now()
);
create index if not exists questions_cree_idx on questions (cree_le desc);

create table if not exists reponses (
  id          bigserial primary key,
  question_id bigint not null references questions(id) on delete cascade,
  auteur      uuid not null references profiles(id) on delete cascade,
  texte       text not null check (char_length(btrim(texte)) between 1 and 2000),
  masquee     boolean not null default false,
  masquee_par uuid references profiles(id),
  cree_le     timestamptz not null default now(),
  modifie_le  timestamptz
);
create index if not exists reponses_question_idx on reponses (question_id, cree_le);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'questions_meilleure_reponse_fkey') then
    alter table questions add constraint questions_meilleure_reponse_fkey
      foreign key (meilleure_reponse) references reponses(id) on delete set null;
  end if;
end $$;

grant select, insert, update, delete on questions to authenticated;
grant usage, select on sequence questions_id_seq to authenticated;
grant select, insert, update, delete on reponses to authenticated;
grant usage, select on sequence reponses_id_seq to authenticated;
alter table questions enable row level security;
alter table reponses enable row level security;

-- bravos et signalements sur les réponses et les questions
alter table reactions drop constraint if exists reactions_cible_type_check;
alter table reactions add constraint reactions_cible_type_check
  check (cible_type in ('publication', 'offre', 'conseil', 'question', 'reponse'));
alter table signalements drop constraint if exists signalements_cible_type_check;
alter table signalements add constraint signalements_cible_type_check
  check (cible_type in ('publication', 'commentaire', 'offre', 'message', 'question', 'reponse'));

-- ------------------------------------------------------------
-- 2. Politiques
-- ------------------------------------------------------------
drop policy if exists questions_lecture on questions;
create policy questions_lecture on questions
  for select to authenticated
  using (mon_statut() = 'valide' and (not masquee or auteur = auth.uid() or est_moderateur()));
drop policy if exists questions_insertion on questions;
create policy questions_insertion on questions
  for insert to authenticated with check (mon_statut() = 'valide' and auteur = auth.uid());
drop policy if exists questions_modification on questions;
create policy questions_modification on questions
  for update to authenticated using (auteur = auth.uid()) with check (auteur = auth.uid());
drop policy if exists questions_suppression on questions;
create policy questions_suppression on questions
  for delete to authenticated using (auteur = auth.uid() or est_admin());

drop policy if exists reponses_lecture on reponses;
create policy reponses_lecture on reponses
  for select to authenticated
  using (mon_statut() = 'valide' and (not masquee or auteur = auth.uid() or est_moderateur()));
drop policy if exists reponses_insertion on reponses;
create policy reponses_insertion on reponses
  for insert to authenticated
  with check (mon_statut() = 'valide' and auteur = auth.uid()
              and exists (select 1 from questions q where q.id = question_id and not q.masquee));
drop policy if exists reponses_modification on reponses;
create policy reponses_modification on reponses
  for update to authenticated using (auteur = auth.uid()) with check (auteur = auth.uid());
drop policy if exists reponses_suppression on reponses;
create policy reponses_suppression on reponses
  for delete to authenticated using (auteur = auth.uid() or est_admin());

-- ------------------------------------------------------------
-- 3. Déclencheurs de tenue
-- ------------------------------------------------------------
create or replace function questions_avant_insert() returns trigger
language plpgsql as $$
begin
  new.titre := btrim(new.titre); new.details := btrim(coalesce(new.details, ''));
  new.theme := nullif(btrim(coalesce(new.theme, '')), '');
  return new;
end $$;
drop trigger if exists questions_avant_insert on questions;
create trigger questions_avant_insert before insert on questions
  for each row execute function questions_avant_insert();

create or replace function questions_avant_update() returns trigger
language plpgsql as $$
begin
  new.maj_le := now();
  -- l'auteur ne touche pas à la modération ni à l'anonymat après coup
  if auth.uid() = old.auteur and not est_moderateur() then
    new.masquee := old.masquee; new.masquee_par := old.masquee_par;
  end if;
  return new;
end $$;
drop trigger if exists questions_avant_update on questions;
create trigger questions_avant_update before update on questions
  for each row execute function questions_avant_update();

create or replace function reponses_avant_update() returns trigger
language plpgsql as $$
begin
  if new.texte <> old.texte then new.modifie_le := now(); end if;
  if auth.uid() = old.auteur and not est_moderateur() then
    new.masquee := old.masquee; new.masquee_par := old.masquee_par;
  end if;
  return new;
end $$;
drop trigger if exists reponses_avant_update on reponses;
create trigger reponses_avant_update before update on reponses
  for each row execute function reponses_avant_update();

-- une question ou une réponse supprimée emporte bravos et signalements
create or replace function nettoyer_rattaches_questions() returns trigger
language plpgsql security definer set search_path = public as $$
declare t text := case when tg_table_name = 'questions' then 'question' else 'reponse' end;
begin
  delete from reactions    where cible_type = t and cible_id = old.id::text;
  delete from signalements where cible_type = t and cible_id = old.id::text;
  return old;
end $$;
drop trigger if exists questions_nettoyage on questions;
create trigger questions_nettoyage after delete on questions
  for each row execute function nettoyer_rattaches_questions();
drop trigger if exists reponses_nettoyage on reponses;
create trigger reponses_nettoyage after delete on reponses
  for each row execute function nettoyer_rattaches_questions();

-- ------------------------------------------------------------
-- 4. Modération (journalisée)
-- ------------------------------------------------------------
create or replace function moderer_question(p_id bigint, p_masquee boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_auteur uuid;
begin
  if not est_moderateur() then raise exception 'Réservé aux délégués et administrateurs.'; end if;
  update questions set masquee = p_masquee, masquee_par = case when p_masquee then auth.uid() end
   where id = p_id returning auteur into v_auteur;
  if v_auteur is null then raise exception 'Question introuvable.'; end if;
  update signalements set traite_le = now(), traite_par = auth.uid()
   where cible_type = 'question' and cible_id = p_id::text and traite_le is null;
  perform journaliser(case when p_masquee then 'masquage_question' else 'retablissement_question' end,
                      v_auteur, jsonb_build_object('question', p_id));
end $$;
revoke all on function moderer_question(bigint, boolean) from public, anon;
grant execute on function moderer_question(bigint, boolean) to authenticated;

create or replace function moderer_reponse(p_id bigint, p_masquee boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_auteur uuid;
begin
  if not est_moderateur() then raise exception 'Réservé aux délégués et administrateurs.'; end if;
  update reponses set masquee = p_masquee, masquee_par = case when p_masquee then auth.uid() end
   where id = p_id returning auteur into v_auteur;
  if v_auteur is null then raise exception 'Réponse introuvable.'; end if;
  update signalements set traite_le = now(), traite_par = auth.uid()
   where cible_type = 'reponse' and cible_id = p_id::text and traite_le is null;
  perform journaliser(case when p_masquee then 'masquage_reponse' else 'retablissement_reponse' end,
                      v_auteur, jsonb_build_object('reponse', p_id));
end $$;
revoke all on function moderer_reponse(bigint, boolean) from public, anon;
grant execute on function moderer_reponse(bigint, boolean) to authenticated;

-- ------------------------------------------------------------
-- 5. Lecture : liste et question ouverte (l'anonymat est appliqué ICI :
--    l'auteur n'est révélé qu'à lui-même et aux modérateurs)
-- ------------------------------------------------------------
create or replace function auteur_question_json(p_auteur uuid, p_anonyme boolean) returns json
language sql stable security invoker set search_path = public as $$
  select case when p_anonyme and p_auteur <> auth.uid() and not est_moderateur() then
    json_build_object('id', null, 'prenom', 'Anonyme', 'nom', '', 'photo_url', null, 'promo', null, 'anonyme', true)
  else (select json_build_object('id', a.id, 'prenom', a.prenom, 'nom', a.nom, 'photo_url', a.photo_url,
                                 'promo', (select numero from promotions where id = a.promotion_id),
                                 'anonyme', p_anonyme)
          from profiles a where a.id = p_auteur) end;
$$;
revoke all on function auteur_question_json(uuid, boolean) from public, anon;
grant execute on function auteur_question_json(uuid, boolean) to authenticated;

create or replace function liste_questions(p_filtre text default 'toutes', p_theme text default null,
                                           p_limite integer default 20, p_avant timestamptz default null)
returns json language sql stable security invoker set search_path = public as $$
  select coalesce(json_agg(json_build_object(
    'id', q.id, 'titre', q.titre, 'details', left(q.details, 160), 'theme', q.theme, 'domaine', q.domaine,
    'anonyme', q.anonyme, 'resolue', q.resolue, 'masquee', q.masquee, 'cree_le', q.cree_le,
    'auteur', auteur_question_json(q.auteur, q.anonyme),
    'nb_reponses', (select count(*) from reponses r where r.question_id = q.id and not r.masquee),
    'bravos', (select count(*) from reactions x where x.cible_type = 'question' and x.cible_id = q.id::text),
    'jai_bravo', exists (select 1 from reactions x where x.cible_type = 'question' and x.cible_id = q.id::text and x.membre = auth.uid())
  ) order by q.cree_le desc), '[]'::json)
  from (
    select * from questions q
    where (p_avant is null or q.cree_le < p_avant)
      and (p_theme is null or q.theme = p_theme)
      and (p_filtre = 'toutes'
           or (p_filtre = 'sans_reponse' and not q.resolue and not exists (select 1 from reponses r where r.question_id = q.id and not r.masquee))
           or (p_filtre = 'resolues' and q.resolue)
           or (p_filtre = 'ouvertes' and not q.resolue)
           or (p_filtre = 'miennes' and q.auteur = auth.uid()))
    order by q.cree_le desc
    limit least(coalesce(p_limite, 20), 50)
  ) q
$$;
revoke all on function liste_questions(text, text, integer, timestamptz) from public, anon;
grant execute on function liste_questions(text, text, integer, timestamptz) to authenticated;

create or replace function lire_question(p_id bigint) returns json
language sql stable security invoker set search_path = public as $$
  select json_build_object(
    'id', q.id, 'titre', q.titre, 'details', q.details, 'theme', q.theme, 'domaine', q.domaine,
    'anonyme', q.anonyme, 'resolue', q.resolue, 'meilleure_reponse', q.meilleure_reponse, 'masquee', q.masquee,
    'cree_le', q.cree_le, 'est_moi', q.auteur = auth.uid(),
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
revoke all on function lire_question(bigint) from public, anon;
grant execute on function lire_question(bigint) to authenticated;

-- ------------------------------------------------------------
-- 6. Notifications push
-- ------------------------------------------------------------
-- nouvelle question → ceux qui répondent aux cadets sur ce sujet (ou sur tout)
create or replace function push_question() returns trigger
language plpgsql security definer set search_path = public as $$
declare cibles uuid[]; v_qui text;
begin
  select array_agg(id) into cibles from profiles
   where statut_compte = 'valide' and id <> new.auteur and repond_cadets
     and (new.theme is null or coalesce(array_length(sujets_cadets, 1), 0) = 0 or new.theme = any(sujets_cadets));
  v_qui := case when new.anonyme then 'Un membre' else (select prenom from profiles where id = new.auteur) end;
  if cibles is not null then
    perform envoyer_push_liste(cibles, v_qui || ' pose une question aux anciens', left(new.titre, 120),
                               '/questions/' || new.id, 'fil', 'question-' || new.id);
  end if;
  return new;
end $$;
drop trigger if exists questions_push on questions;
create trigger questions_push after insert on questions
  for each row execute function push_question();

-- réponse → l'auteur de la question (toujours), et ceux qui ont déjà répondu (famille fil)
create or replace function push_reponse() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_q questions%rowtype; v_qui text; autres uuid[];
begin
  select * into v_q from questions where id = new.question_id;
  select prenom || ' ' || nom into v_qui from profiles where id = new.auteur;
  if v_q.auteur <> new.auteur then
    perform envoyer_push(v_q.auteur, v_qui || ' a répondu à ta question', left(new.texte, 120),
                         '/questions/' || new.question_id, 'mes_demandes');
  end if;
  select array_agg(distinct auteur) into autres from reponses
   where question_id = new.question_id and auteur <> new.auteur and auteur <> v_q.auteur and not masquee;
  if autres is not null then
    perform envoyer_push_liste(autres, v_qui || ' a aussi répondu', left(v_q.titre, 100),
                               '/questions/' || new.question_id, 'fil', 'rep-' || new.question_id);
  end if;
  return new;
end $$;
drop trigger if exists reponses_push on reponses;
create trigger reponses_push after insert on reponses
  for each row execute function push_reponse();

-- meilleure réponse choisie → son auteur
create or replace function push_meilleure_reponse() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_auteur uuid; v_qui text;
begin
  if new.meilleure_reponse is null or new.meilleure_reponse is not distinct from old.meilleure_reponse then return new; end if;
  select auteur into v_auteur from reponses where id = new.meilleure_reponse;
  if v_auteur is null or v_auteur = new.auteur then return new; end if;
  v_qui := case when new.anonyme then 'L''auteur de la question' else (select prenom from profiles where id = new.auteur) end;
  perform envoyer_push(v_auteur, v_qui || ' a retenu ta réponse', left(new.titre, 120),
                       '/questions/' || new.id, 'mes_demandes');
  return new;
end $$;
drop trigger if exists questions_push_meilleure on questions;
create trigger questions_push_meilleure after update of meilleure_reponse on questions
  for each row execute function push_meilleure_reponse();

-- masquage → l'auteur (transparence, comme le Fil)
create or replace function push_masquage_question() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.masquee and not old.masquee then
    perform envoyer_push(new.auteur,
      case when tg_table_name = 'questions' then 'Ta question a été masquée' else 'Ta réponse a été masquée' end,
      'La modération l''a retirée de la vue des autres membres. Écris à un délégué pour en parler.',
      '/questions/' || case when tg_table_name = 'questions' then new.id else new.question_id end, 'mes_demandes');
  end if;
  return new;
end $$;
drop trigger if exists questions_push_masquage on questions;
create trigger questions_push_masquage after update of masquee on questions
  for each row execute function push_masquage_question();
drop trigger if exists reponses_push_masquage on reponses;
create trigger reponses_push_masquage after update of masquee on reponses
  for each row execute function push_masquage_question();

-- les bravos sur une question ou une réponse préviennent leur auteur (extension de push_bravo)
create or replace function push_bravo() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_auteur uuid; v_qui text; v_texte text; v_quoi text; v_url text; v_anonyme boolean := false;
begin
  if new.cible_type = 'publication' then
    select auteur, coalesce(nullif(left(texte, 100), ''), 'Ta photo ou ta vidéo') into v_auteur, v_texte
      from publications where id = new.cible_id::bigint;
    v_quoi := 'ta publication'; v_url := '/publication/' || new.cible_id;
  elsif new.cible_type = 'offre' then
    select posteur, left(titre, 100) into v_auteur, v_texte from offres where id = new.cible_id::bigint;
    v_quoi := 'ton offre'; v_url := '/offres/' || new.cible_id;
  elsif new.cible_type = 'question' then
    select auteur, left(titre, 100) into v_auteur, v_texte from questions where id = new.cible_id::bigint;
    v_quoi := 'ta question'; v_url := '/questions/' || new.cible_id;
  elsif new.cible_type = 'reponse' then
    select r.auteur, left(q.titre, 100) into v_auteur, v_texte from reponses r join questions q on q.id = r.question_id where r.id = new.cible_id::bigint;
    v_quoi := 'ta réponse'; v_url := '/questions/' || (select question_id from reponses where id = new.cible_id::bigint);
  else
    select id, left(conseil, 100) into v_auteur, v_texte from profiles where id = new.cible_id::uuid;
    v_quoi := 'ton conseil aux cadets'; v_url := '/profil/' || new.cible_id;
  end if;
  if v_auteur is null or v_auteur = new.membre then return new; end if;
  select prenom || ' ' || nom into v_qui from profiles where id = new.membre;
  perform envoyer_push_liste(array[v_auteur], v_qui || ' a applaudi ' || v_quoi, coalesce(v_texte, ''),
    v_url, 'mes_demandes', 'bravo-' || new.cible_type || '-' || new.cible_id);
  return new;
end $$;

-- ------------------------------------------------------------
-- 7. Contrôle de santé
-- ------------------------------------------------------------
insert into sante_fonctions_ouvertes (nom, raison) values
  ('moderer_question',    'modération : masquer/rétablir une question (journalisé)'),
  ('moderer_reponse',     'modération : masquer/rétablir une réponse (journalisé)'),
  ('auteur_question_json','questions : auteur ou « Anonyme » selon qui regarde'),
  ('liste_questions',     'questions : la liste, filtrée'),
  ('lire_question',       'questions : une question et ses réponses')
on conflict (nom) do nothing;

-- Vérifications (une instruction à la fois dans l'éditeur SQL) :
--   select count(*) from pg_policies where tablename in ('questions', 'reponses');  -- 8
--   select json_array_length(liste_questions('toutes'));
--   select * from sante_systeme where verdict like 'PROBL%';   -- rien = tout va bien
