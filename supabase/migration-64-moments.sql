-- ============================================================
-- Migration 64 — Moments (brique 4 du réseau social)
--   Une photo ou une vidéo courte, avec une légende, qui vit 24 h, 3 jours
--   ou 7 jours puis disparaît avec son fichier. Rail en haut du Fil, lecture
--   plein écran, cercle de visibilité comme les publications, « vu par »
--   réservé à l'auteur, bravo, signalement et masquage journalisés.
--   Pas de notification push (décision : le rail et la pastille de
--   l'onglet Fil suffisent).
--   Rejouable.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tables
-- ------------------------------------------------------------
create table if not exists moments (
  id            bigserial primary key,
  auteur        uuid not null references profiles(id) on delete cascade,
  media_chemin  text not null,                     -- bucket medias : <uuid-auteur>/moment-<horodatage>.jpg|mp4
  media_type    text not null check (media_type in ('photo', 'video')),
  legende       text not null default '' check (char_length(legende) <= 200),
  visibilite    text not null default 'tous' check (visibilite in ('tous', 'promo', 'domaine')),
  duree_heures  integer not null default 72 check (duree_heures in (24, 72, 168)),
  expire_le     timestamptz not null default now() + interval '72 hours',
  masque        boolean not null default false,
  masque_par    uuid references profiles(id),
  cree_le       timestamptz not null default now()
);
create index if not exists moments_expire_idx on moments (expire_le);
create index if not exists moments_auteur_idx on moments (auteur, cree_le desc);
grant select, insert, delete on moments to authenticated;
grant usage, select on sequence moments_id_seq to authenticated;
alter table moments enable row level security;

create table if not exists moment_vues (
  moment_id  bigint not null references moments(id) on delete cascade,
  membre     uuid not null references profiles(id) on delete cascade,
  vu_le      timestamptz not null default now(),
  primary key (moment_id, membre)
);
grant select, insert on moment_vues to authenticated;
alter table moment_vues enable row level security;

-- l'expiration découle de la durée choisie ; la légende est nettoyée
create or replace function moments_avant_insert() returns trigger
language plpgsql as $$
begin
  new.legende := btrim(coalesce(new.legende, ''));
  new.expire_le := now() + make_interval(hours => new.duree_heures);
  return new;
end $$;
drop trigger if exists moments_avant_insert on moments;
create trigger moments_avant_insert before insert on moments
  for each row execute function moments_avant_insert();

-- ------------------------------------------------------------
-- 2. Politiques
-- ------------------------------------------------------------
drop policy if exists moments_lecture on moments;
create policy moments_lecture on moments
  for select to authenticated
  using (mon_statut() = 'valide'
         and expire_le > now()
         and (not masque or auteur = auth.uid() or est_moderateur())
         and dans_le_cercle(auteur, visibilite));
drop policy if exists moments_insertion on moments;
create policy moments_insertion on moments
  for insert to authenticated
  with check (mon_statut() = 'valide' and auteur = auth.uid());
drop policy if exists moments_suppression on moments;
create policy moments_suppression on moments
  for delete to authenticated
  using (auteur = auth.uid() or est_admin());

-- qui a vu : chacun ses propres vues, l'auteur celles de ses moments
drop policy if exists moment_vues_lecture on moment_vues;
create policy moment_vues_lecture on moment_vues
  for select to authenticated
  using (membre = auth.uid() or exists (select 1 from moments m where m.id = moment_id and m.auteur = auth.uid()));
drop policy if exists moment_vues_insertion on moment_vues;
create policy moment_vues_insertion on moment_vues
  for insert to authenticated
  with check (mon_statut() = 'valide' and membre = auth.uid()
              and exists (select 1 from moments m where m.id = moment_id));   -- passe par la lecture (cercle, expiration)

-- bravos et signalements sur un moment
alter table reactions drop constraint if exists reactions_cible_type_check;
alter table reactions add constraint reactions_cible_type_check
  check (cible_type in ('publication', 'offre', 'conseil', 'question', 'reponse', 'moment'));
alter table signalements drop constraint if exists signalements_cible_type_check;
alter table signalements add constraint signalements_cible_type_check
  check (cible_type in ('publication', 'commentaire', 'offre', 'message', 'question', 'reponse', 'moment'));

create or replace function basculer_bravo(p_type text, p_id text) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if mon_statut() <> 'valide' then raise exception 'Réservé aux membres validés.'; end if;
  if p_type not in ('publication', 'offre', 'conseil', 'question', 'reponse', 'moment') then raise exception 'Cible inconnue.'; end if;
  if exists (select 1 from reactions where cible_type = p_type and cible_id = p_id and membre = auth.uid()) then
    delete from reactions where cible_type = p_type and cible_id = p_id and membre = auth.uid();
  else
    insert into reactions (cible_type, cible_id, membre) values (p_type, p_id, auth.uid());
  end if;
  select count(*) into n from reactions where cible_type = p_type and cible_id = p_id;
  return n;
end $$;

create or replace function push_signalement() returns trigger
language plpgsql security definer set search_path = public as $$
declare cibles uuid[];
begin
  select array_agg(id) into cibles from profiles
   where statut_compte = 'valide' and role in ('delegue', 'admin') and id <> new.auteur;
  if cibles is not null then
    perform envoyer_push_liste(cibles, 'Un contenu a été signalé',
      'Un membre signale ' || case new.cible_type
        when 'publication' then 'une publication'
        when 'commentaire' then 'un commentaire'
        when 'message'     then 'un message'
        when 'question'    then 'une question aux anciens'
        when 'reponse'     then 'une réponse à une question'
        when 'moment'      then 'un moment'
        else 'une offre' end
      || ' : ' || left(new.motif, 100), '/admin', null);
  end if;
  return new;
end $$;

-- ------------------------------------------------------------
-- 3. Lecture : le rail (auteurs et leurs moments en cours)
--    Moi d'abord, puis les auteurs qui ont du non-vu, puis les autres, par
--    fraîcheur du dernier moment. Les vues ne sont comptées que pour mes
--    propres moments.
-- ------------------------------------------------------------
create or replace function rail_moments() returns json
language sql stable security invoker set search_path = public as $$
  with visibles as (
    select m.* from moments m where m.expire_le > now()   -- la politique fait le reste
  ),
  par_auteur as (
    select a.id as auteur_id,
           json_build_object('id', a.id, 'prenom', a.prenom, 'nom', a.nom, 'photo_url', a.photo_url,
                             'promo', (select numero from promotions where id = a.promotion_id)) as auteur,
           max(m.cree_le) as dernier,
           bool_and(exists (select 1 from moment_vues v where v.moment_id = m.id and v.membre = auth.uid())) as tout_vu,
           json_agg(json_build_object(
             'id', m.id, 'media_chemin', m.media_chemin, 'media_type', m.media_type, 'legende', m.legende,
             'visibilite', m.visibilite, 'masque', m.masque, 'cree_le', m.cree_le, 'expire_le', m.expire_le,
             'vu', exists (select 1 from moment_vues v where v.moment_id = m.id and v.membre = auth.uid()),
             'vues', case when m.auteur = auth.uid() then (select count(*) from moment_vues v where v.moment_id = m.id) end,
             'bravos', (select count(*) from reactions r where r.cible_type = 'moment' and r.cible_id = m.id::text),
             'jai_bravo', exists (select 1 from reactions r where r.cible_type = 'moment' and r.cible_id = m.id::text and r.membre = auth.uid())
           ) order by m.cree_le) as moments
      from visibles m join profiles a on a.id = m.auteur
     group by a.id, a.prenom, a.nom, a.photo_url, a.promotion_id
  )
  select coalesce(json_agg(json_build_object('auteur', auteur, 'tout_vu', tout_vu, 'moments', moments)
           order by (auteur_id = auth.uid()) desc, tout_vu asc, dernier desc), '[]'::json)
    from par_auteur
$$;
revoke all on function rail_moments() from public, anon;
grant execute on function rail_moments() to authenticated;

-- combien de moments non vus (pastille de l'onglet Fil)
create or replace function moments_non_vus() returns integer
language sql stable security invoker set search_path = public as $$
  select count(*)::int from moments m
   where m.expire_le > now() and m.auteur <> auth.uid()
     and not exists (select 1 from moment_vues v where v.moment_id = m.id and v.membre = auth.uid())
$$;
revoke all on function moments_non_vus() from public, anon;
grant execute on function moments_non_vus() to authenticated;

-- qui a vu mon moment (auteur seulement)
create or replace function vues_moment(p_id bigint) returns json
language sql stable security invoker set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', p.id, 'prenom', p.prenom, 'nom', p.nom, 'photo_url', p.photo_url, 'vu_le', v.vu_le)
                  order by v.vu_le desc), '[]'::json)
    from moment_vues v join profiles p on p.id = v.membre
    join moments m on m.id = v.moment_id
   where v.moment_id = p_id and m.auteur = auth.uid()
$$;
revoke all on function vues_moment(bigint) from public, anon;
grant execute on function vues_moment(bigint) to authenticated;

-- ------------------------------------------------------------
-- 4. Modération : masquer / rétablir, tracé au journal
-- ------------------------------------------------------------
create or replace function moderer_moment(p_id bigint, p_masque boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_auteur uuid;
begin
  if not est_moderateur() then raise exception 'Réservé aux délégués et administrateurs.'; end if;
  update moments set masque = p_masque, masque_par = case when p_masque then auth.uid() end
   where id = p_id returning auteur into v_auteur;
  if v_auteur is null then raise exception 'Moment introuvable.'; end if;
  update signalements set traite_le = now(), traite_par = auth.uid()
   where cible_type = 'moment' and cible_id = p_id::text and traite_le is null;
  perform journaliser(case when p_masque then 'masquage_moment' else 'retablissement_moment' end,
                      v_auteur, jsonb_build_object('moment', p_id));
end $$;
revoke all on function moderer_moment(bigint, boolean) from public, anon;
grant execute on function moderer_moment(bigint, boolean) to authenticated;

-- ------------------------------------------------------------
-- 5. Purge horaire : moments expirés et leurs fichiers (pg_net + clé
--    service_role du Vault, même mécanique que purge_videos_expirees)
-- ------------------------------------------------------------
create or replace function purge_moments_expires() returns integer
language plpgsql security definer set search_path = public as $$
declare
  cle  text;
  base text := 'https://pdjbqdwurwgxzghehldr.supabase.co/storage/v1/object/medias/';
  v    record;
  n    integer := 0;
begin
  select decrypted_secret into cle from vault.decrypted_secrets where name = 'service_role_key';
  for v in select id, media_chemin from moments where expire_le < now() loop
    if cle is not null then
      perform net.http_delete(
        url     := base || v.media_chemin,
        headers := jsonb_build_object('Authorization', 'Bearer ' || cle, 'apikey', cle));
    end if;
    delete from reactions where cible_type = 'moment' and cible_id = v.id::text;
    delete from moments where id = v.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function purge_moments_expires() from public, anon, authenticated;
select cron.schedule('purge-moments', '20 * * * *', $$select purge_moments_expires()$$);

-- un bravo sur un moment prévient son auteur (la branche par défaut du
-- déclencheur, faite pour les conseils, castait l'identifiant en uuid)
create or replace function push_bravo() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_auteur uuid; v_qui text; v_texte text; v_quoi text; v_url text;
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
  elsif new.cible_type = 'moment' then
    select auteur, coalesce(nullif(legende, ''), 'Ton moment') into v_auteur, v_texte from moments where id = new.cible_id::bigint;
    v_quoi := 'ton moment'; v_url := '/fil?moment=' || new.cible_id;
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
-- 6. Registre des fonctions ouvertes (contrôle de santé)
-- ------------------------------------------------------------
insert into sante_fonctions_ouvertes (nom, raison) values
  ('rail_moments',    'moments : le rail du Fil (auteurs et moments en cours)'),
  ('moments_non_vus', 'moments : pastille de l''onglet Fil'),
  ('vues_moment',     'moments : qui a vu (auteur seulement)'),
  ('moderer_moment',  'modération : masquer/rétablir un moment (journalisé)')
on conflict (nom) do nothing;

-- Vérifications (une instruction à la fois dans l'éditeur SQL) :
--   select count(*) from pg_policies where tablename in ('moments', 'moment_vues');   -- 5
--   select jobname from cron.job where jobname = 'purge-moments';
--   select rail_moments();   -- [] tant que personne n'a publié
