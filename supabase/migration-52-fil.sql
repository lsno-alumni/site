-- Migration 52 — LE FIL (brique 1 du chantier « réseau social », 26/09/2026).
--
-- Publications des membres (texte, photo OU vidéo), réactions « bravo »
-- (publications, offres, conseils), commentaires (publications, offres, avec
-- réponses), signalements, modération par les délégués/admins, purge des
-- vidéos expirées, notifications push.
--
-- Décisions (26/09) : tous les membres validés publient ; PAS de commentaires
-- sur les profils ; vidéos 30 s / 20 Mo / 14 jours de vie (stockage et débit
-- comptés sur le palier gratuit) ; une photo ou une vidéo par publication.
--
-- Ajouts purs : rien d'existant n'est modifié. Rejouable.
-- ⚠ À exécuter sur le projet Supabase LSNO Amicale (pdjbqdwurwgxzghehldr).
-- ⚠ AVANT : créer le bucket Storage « medias » (public, 20 Mo max, images +
--    vidéos) dans Dashboard → Storage — comme « ressources » (migration 25).

-- ------------------------------------------------------------
-- 0. Qui modère : délégués et admins validés
-- ------------------------------------------------------------
create or replace function est_moderateur() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role in ('delegue', 'admin') and statut_compte = 'valide'
     from profiles where id = auth.uid()), false);
$$;
revoke all on function est_moderateur() from public, anon;
grant execute on function est_moderateur() to authenticated;

-- ------------------------------------------------------------
-- 1. Publications
-- ------------------------------------------------------------
create table if not exists publications (
  id              bigserial primary key,
  auteur          uuid not null references profiles(id) on delete cascade,
  texte           text not null default '' check (char_length(texte) <= 1000),
  -- média : chemin dans le bucket « medias » (« <uuid-auteur>/<horodatage>-<nom> »)
  media_chemin    text,
  media_type      text check (media_type in ('photo', 'video', 'video_expiree')),
  media_expire_le timestamptz,               -- vidéos seulement : cree_le + 14 jours
  masquee         boolean not null default false,   -- modération
  masquee_par     uuid references profiles(id),
  cree_le         timestamptz not null default now(),
  maj_le          timestamptz not null default now(),
  check (texte <> '' or media_chemin is not null)
);
create index if not exists publications_cree_idx   on publications (cree_le desc);
create index if not exists publications_auteur_idx on publications (auteur);

grant select, insert, update, delete on publications to authenticated;
grant usage, select on sequence publications_id_seq to authenticated;
alter table publications enable row level security;

drop policy if exists publications_lecture on publications;
create policy publications_lecture on publications
  for select to authenticated
  using (mon_statut() = 'valide' and (not masquee or auteur = auth.uid() or est_moderateur()));

drop policy if exists publications_insertion on publications;
create policy publications_insertion on publications
  for insert to authenticated
  with check (mon_statut() = 'valide' and auteur = auth.uid());

-- l'auteur corrige son texte ; la modération passe par moderer_publication()
drop policy if exists publications_modification on publications;
create policy publications_modification on publications
  for update to authenticated
  using (auteur = auth.uid())
  with check (auteur = auth.uid());

drop policy if exists publications_suppression on publications;
create policy publications_suppression on publications
  for delete to authenticated
  using (auteur = auth.uid() or est_admin());

-- vidéos : la date d'expiration se pose toute seule
create or replace function publications_avant_insert() returns trigger
language plpgsql as $$
begin
  new.texte := btrim(new.texte);
  if new.media_type = 'video' and new.media_expire_le is null then
    new.media_expire_le := now() + interval '14 days';
  end if;
  return new;
end $$;
drop trigger if exists publications_avant_insert on publications;
create trigger publications_avant_insert before insert on publications
  for each row execute function publications_avant_insert();

create or replace function publications_maj() returns trigger
language plpgsql as $$
begin new.maj_le := now(); return new; end $$;
drop trigger if exists publications_maj on publications;
create trigger publications_maj before update on publications
  for each row execute function publications_maj();

-- ------------------------------------------------------------
-- 2. Réactions « bravo » — sur une publication, une offre ou un conseil
-- ------------------------------------------------------------
create table if not exists reactions (
  cible_type text not null check (cible_type in ('publication', 'offre', 'conseil')),
  cible_id   text not null,                 -- id de publication / d'offre, ou uuid du profil (conseil)
  membre     uuid not null references profiles(id) on delete cascade,
  cree_le    timestamptz not null default now(),
  primary key (cible_type, cible_id, membre)
);
create index if not exists reactions_cible_idx on reactions (cible_type, cible_id);

grant select, insert, delete on reactions to authenticated;
alter table reactions enable row level security;

drop policy if exists reactions_lecture on reactions;
create policy reactions_lecture on reactions
  for select to authenticated using (mon_statut() = 'valide');
drop policy if exists reactions_insertion on reactions;
create policy reactions_insertion on reactions
  for insert to authenticated with check (mon_statut() = 'valide' and membre = auth.uid());
drop policy if exists reactions_suppression on reactions;
create policy reactions_suppression on reactions
  for delete to authenticated using (membre = auth.uid());

-- un tap = on ajoute ou on retire ; renvoie le nouveau total
create or replace function basculer_bravo(p_type text, p_id text) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if mon_statut() <> 'valide' then raise exception 'Réservé aux membres validés.'; end if;
  if p_type not in ('publication', 'offre', 'conseil') then raise exception 'Cible inconnue.'; end if;
  if exists (select 1 from reactions where cible_type = p_type and cible_id = p_id and membre = auth.uid()) then
    delete from reactions where cible_type = p_type and cible_id = p_id and membre = auth.uid();
  else
    insert into reactions (cible_type, cible_id, membre) values (p_type, p_id, auth.uid());
  end if;
  select count(*) into n from reactions where cible_type = p_type and cible_id = p_id;
  return n;
end $$;
revoke all on function basculer_bravo(text, text) from public, anon;
grant execute on function basculer_bravo(text, text) to authenticated;

-- ------------------------------------------------------------
-- 3. Commentaires — sur une publication ou une offre (jamais un profil)
-- ------------------------------------------------------------
create table if not exists commentaires (
  id         bigserial primary key,
  cible_type text not null check (cible_type in ('publication', 'offre')),
  cible_id   text not null,
  auteur     uuid not null references profiles(id) on delete cascade,
  texte      text not null check (char_length(btrim(texte)) between 1 and 600),
  reponse_a  bigint references commentaires(id) on delete set null,
  masque     boolean not null default false,
  masque_par uuid references profiles(id),
  cree_le    timestamptz not null default now()
);
create index if not exists commentaires_cible_idx on commentaires (cible_type, cible_id, cree_le);

grant select, insert, update, delete on commentaires to authenticated;
grant usage, select on sequence commentaires_id_seq to authenticated;
alter table commentaires enable row level security;

drop policy if exists commentaires_lecture on commentaires;
create policy commentaires_lecture on commentaires
  for select to authenticated
  using (mon_statut() = 'valide' and (not masque or auteur = auth.uid() or est_moderateur()));
drop policy if exists commentaires_insertion on commentaires;
create policy commentaires_insertion on commentaires
  for insert to authenticated
  with check (mon_statut() = 'valide' and auteur = auth.uid());
drop policy if exists commentaires_modification on commentaires;
create policy commentaires_modification on commentaires
  for update to authenticated using (auteur = auth.uid()) with check (auteur = auth.uid());
drop policy if exists commentaires_suppression on commentaires;
create policy commentaires_suppression on commentaires
  for delete to authenticated using (auteur = auth.uid() or est_admin());

-- ------------------------------------------------------------
-- 4. Signalements — un membre signale, les modérateurs traitent
-- ------------------------------------------------------------
create table if not exists signalements (
  id         bigserial primary key,
  cible_type text not null check (cible_type in ('publication', 'commentaire', 'offre')),
  cible_id   text not null,
  auteur     uuid not null references profiles(id) on delete cascade,
  motif      text not null check (char_length(btrim(motif)) between 1 and 300),
  cree_le    timestamptz not null default now(),
  traite_le  timestamptz,
  traite_par uuid references profiles(id),
  unique (cible_type, cible_id, auteur)
);
grant select, insert, update on signalements to authenticated;
grant usage, select on sequence signalements_id_seq to authenticated;
alter table signalements enable row level security;

drop policy if exists signalements_lecture on signalements;
create policy signalements_lecture on signalements
  for select to authenticated using (auteur = auth.uid() or est_moderateur());
drop policy if exists signalements_insertion on signalements;
create policy signalements_insertion on signalements
  for insert to authenticated with check (mon_statut() = 'valide' and auteur = auth.uid());
drop policy if exists signalements_traitement on signalements;
create policy signalements_traitement on signalements
  for update to authenticated using (est_moderateur()) with check (est_moderateur());

-- ------------------------------------------------------------
-- 5. Modération : masquer / rétablir, tracé au journal
-- ------------------------------------------------------------
create or replace function moderer_publication(p_id bigint, p_masquee boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_auteur uuid;
begin
  if not est_moderateur() then raise exception 'Réservé aux délégués et administrateurs.'; end if;
  update publications set masquee = p_masquee, masquee_par = case when p_masquee then auth.uid() end
   where id = p_id returning auteur into v_auteur;
  if v_auteur is null then raise exception 'Publication introuvable.'; end if;
  update signalements set traite_le = now(), traite_par = auth.uid()
   where cible_type = 'publication' and cible_id = p_id::text and traite_le is null;
  perform journaliser(case when p_masquee then 'masquage_publication' else 'retablissement_publication' end,
                      v_auteur, jsonb_build_object('publication', p_id));
end $$;
revoke all on function moderer_publication(bigint, boolean) from public, anon;
grant execute on function moderer_publication(bigint, boolean) to authenticated;

create or replace function moderer_commentaire(p_id bigint, p_masque boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_auteur uuid;
begin
  if not est_moderateur() then raise exception 'Réservé aux délégués et administrateurs.'; end if;
  update commentaires set masque = p_masque, masque_par = case when p_masque then auth.uid() end
   where id = p_id returning auteur into v_auteur;
  if v_auteur is null then raise exception 'Commentaire introuvable.'; end if;
  update signalements set traite_le = now(), traite_par = auth.uid()
   where cible_type = 'commentaire' and cible_id = p_id::text and traite_le is null;
  perform journaliser(case when p_masque then 'masquage_commentaire' else 'retablissement_commentaire' end,
                      v_auteur, jsonb_build_object('commentaire', p_id));
end $$;
revoke all on function moderer_commentaire(bigint, boolean) from public, anon;
grant execute on function moderer_commentaire(bigint, boolean) to authenticated;

-- ------------------------------------------------------------
-- 6. Ménage : une publication ou une offre supprimée emporte ce qui s'y rattache
--    (les tables sont polymorphes, donc pas de cascade par clé étrangère)
-- ------------------------------------------------------------
create or replace function nettoyer_rattaches() returns trigger
language plpgsql security definer set search_path = public as $$
declare t text := case when tg_table_name = 'publications' then 'publication' else 'offre' end;
begin
  delete from reactions    where cible_type = t and cible_id = old.id::text;
  delete from commentaires where cible_type = t and cible_id = old.id::text;
  delete from signalements where cible_type = t and cible_id = old.id::text;
  return old;
end $$;
drop trigger if exists publications_nettoyage on publications;
create trigger publications_nettoyage after delete on publications
  for each row execute function nettoyer_rattaches();
drop trigger if exists offres_nettoyage on offres;
create trigger offres_nettoyage after delete on offres
  for each row execute function nettoyer_rattaches();

-- ------------------------------------------------------------
-- 7. Lecture du fil : une publication avec son auteur et ses compteurs
-- ------------------------------------------------------------
create or replace function fil_publications(p_limite integer default 20, p_avant timestamptz default null)
returns json language sql stable security invoker set search_path = public as $$
  select coalesce(json_agg(json_build_object(
    'id', p.id,
    'texte', p.texte,
    'media_chemin', p.media_chemin,
    'media_type', p.media_type,
    'media_expire_le', p.media_expire_le,
    'masquee', p.masquee,
    'cree_le', p.cree_le,
    'auteur', json_build_object('id', a.id, 'prenom', a.prenom, 'nom', a.nom, 'photo_url', a.photo_url,
                                'promo', (select numero from promotions where id = a.promotion_id)),
    'bravos', (select count(*) from reactions r where r.cible_type = 'publication' and r.cible_id = p.id::text),
    'commentaires', (select count(*) from commentaires c where c.cible_type = 'publication' and c.cible_id = p.id::text and not c.masque),
    'jai_bravo', exists (select 1 from reactions r where r.cible_type = 'publication' and r.cible_id = p.id::text and r.membre = auth.uid())
  ) order by p.cree_le desc), '[]'::json)
  from (
    select * from publications
    where (p_avant is null or cree_le < p_avant)
    order by cree_le desc
    limit least(coalesce(p_limite, 20), 50)
  ) p
  join profiles a on a.id = p.auteur
$$;
revoke all on function fil_publications(integer, timestamptz) from public, anon;
grant execute on function fil_publications(integer, timestamptz) to authenticated;

-- compteurs et « j'ai bravo » d'une cible quelconque (offre, conseil)
create or replace function bravos_de(p_type text, p_id text) returns json
language sql stable security invoker set search_path = public as $$
  select json_build_object(
    'bravos', (select count(*) from reactions where cible_type = p_type and cible_id = p_id),
    'jai_bravo', exists (select 1 from reactions where cible_type = p_type and cible_id = p_id and membre = auth.uid()),
    'commentaires', (select count(*) from commentaires where cible_type = p_type and cible_id = p_id and not masque))
$$;
revoke all on function bravos_de(text, text) from public, anon;
grant execute on function bravos_de(text, text) to authenticated;

-- les commentaires d'une cible, avec leurs auteurs, du plus ancien au plus récent
create or replace function commentaires_de(p_type text, p_id text) returns json
language sql stable security invoker set search_path = public as $$
  select coalesce(json_agg(json_build_object(
    'id', c.id, 'texte', c.texte, 'reponse_a', c.reponse_a, 'masque', c.masque, 'cree_le', c.cree_le,
    'auteur', json_build_object('id', a.id, 'prenom', a.prenom, 'nom', a.nom, 'photo_url', a.photo_url,
                                'promo', (select numero from promotions where id = a.promotion_id))
  ) order by c.cree_le), '[]'::json)
  from commentaires c join profiles a on a.id = c.auteur
  where c.cible_type = p_type and c.cible_id = p_id
$$;
revoke all on function commentaires_de(text, text) from public, anon;
grant execute on function commentaires_de(text, text) to authenticated;

-- ------------------------------------------------------------
-- 8. Stockage : bucket « medias » (photos et vidéos des publications)
--    chemin : « <uuid-auteur>/<horodatage>-<nom> »
-- ------------------------------------------------------------
drop policy if exists "medias_lecture" on storage.objects;
create policy "medias_lecture" on storage.objects
  for select to authenticated using (bucket_id = 'medias');
drop policy if exists "medias_ajout" on storage.objects;
create policy "medias_ajout" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'medias'
    and split_part(name, '/', 1) = auth.uid()::text
    and (select statut_compte from profiles where id = auth.uid()) = 'valide');
drop policy if exists "medias_suppression" on storage.objects;
create policy "medias_suppression" on storage.objects
  for delete to authenticated
  using (bucket_id = 'medias'
    and (split_part(name, '/', 1) = auth.uid()::text
         or (select role from profiles where id = auth.uid()) = 'admin'));

-- ------------------------------------------------------------
-- 9. Purge des vidéos expirées (14 jours) — tous les jours à 04:30 UTC
--    même mécanique que purge_offres_cloturees() (migration 26) : le Storage
--    s'efface via pg_net + clé service_role du Vault
-- ------------------------------------------------------------
create or replace function purge_videos_expirees() returns void
language plpgsql security definer set search_path = public as $$
declare
  cle  text;
  base text := 'https://pdjbqdwurwgxzghehldr.supabase.co/storage/v1/object/medias/';
  v    record;
begin
  select decrypted_secret into cle from vault.decrypted_secrets where name = 'service_role_key';
  for v in
    select id, media_chemin from publications
    where media_type = 'video' and media_expire_le < now() and media_chemin is not null
  loop
    if cle is not null then
      perform net.http_delete(
        url     := base || v.media_chemin,
        headers := jsonb_build_object('Authorization', 'Bearer ' || cle, 'apikey', cle));
    end if;
    -- la publication garde son texte ; l'app affiche « vidéo expirée »
    update publications set media_chemin = null, media_type = 'video_expiree' where id = v.id;
  end loop;
end $$;
revoke all on function purge_videos_expirees() from public, anon, authenticated;

-- (un nom de tâche déjà pris est remplacé par cron.schedule : rejouable)
select cron.schedule('purge-videos-expirees', '30 4 * * *', $$select purge_videos_expirees()$$);

-- ------------------------------------------------------------
-- 10. Notifications push
--     - commentaire → l'auteur de la publication / de l'offre, et la personne
--       à qui l'on répond (famille « mes_demandes » : ce qui ME concerne)
--     - signalement → les modérateurs (toujours, hors préférences)
-- ------------------------------------------------------------
create or replace function push_commentaire() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_qui    text;
  v_cible  uuid;
  v_titre  text;
  v_url    text;
  v_repond uuid;
begin
  select prenom || ' ' || nom into v_qui from profiles where id = new.auteur;
  if new.cible_type = 'publication' then
    select auteur into v_cible from publications where id = new.cible_id::bigint;
    v_titre := v_qui || ' a commenté ta publication';
    v_url   := '/publication/' || new.cible_id;
  else
    select posteur into v_cible from offres where id = new.cible_id::bigint;
    v_titre := v_qui || ' a commenté ton offre';
    v_url   := '/offres/' || new.cible_id;
  end if;
  if v_cible is not null and v_cible <> new.auteur then
    perform envoyer_push(v_cible, v_titre, left(new.texte, 120), v_url, 'mes_demandes');
  end if;
  if new.reponse_a is not null then
    select auteur into v_repond from commentaires where id = new.reponse_a;
    if v_repond is not null and v_repond <> new.auteur and v_repond is distinct from v_cible then
      perform envoyer_push(v_repond, v_qui || ' t''a répondu', left(new.texte, 120), v_url, 'mes_demandes');
    end if;
  end if;
  return new;
end $$;
drop trigger if exists commentaires_push on commentaires;
create trigger commentaires_push after insert on commentaires
  for each row execute function push_commentaire();

create or replace function push_signalement() returns trigger
language plpgsql security definer set search_path = public as $$
declare cibles uuid[];
begin
  select array_agg(id) into cibles from profiles
   where statut_compte = 'valide' and role in ('delegue', 'admin') and id <> new.auteur;
  if cibles is not null then
    perform envoyer_push_liste(cibles, 'Un contenu a été signalé',
      'Un membre signale ' || case new.cible_type when 'publication' then 'une publication'
                                                  when 'commentaire' then 'un commentaire' else 'une offre' end
      || ' : ' || left(new.motif, 100), '/admin', null);
  end if;
  return new;
end $$;
drop trigger if exists signalements_push on signalements;
create trigger signalements_push after insert on signalements
  for each row execute function push_signalement();

-- ------------------------------------------------------------
-- 11. Contrôle de santé : les RPC que le navigateur a le droit d'appeler
-- ------------------------------------------------------------
insert into sante_fonctions_ouvertes (nom, raison) values
  ('basculer_bravo',       'fil : ajouter/retirer un bravo'),
  ('moderer_publication',  'modération : masquer/rétablir une publication (journalisé)'),
  ('moderer_commentaire',  'modération : masquer/rétablir un commentaire (journalisé)'),
  ('est_moderateur',       'fil : sait si l''appelant peut modérer')
on conflict (nom) do nothing;

-- Vérifications (une instruction à la fois dans l'éditeur SQL) :
--   select count(*) from pg_policies where tablename in ('publications','reactions','commentaires','signalements');  -- 14
--   select jobname from cron.job where jobname = 'purge-videos-expirees';
--   select * from sante_systeme where verdict like 'PROBL%';   -- rien = tout va bien
