-- ============================================================
-- Migration 66 — Événements (brique 5 du réseau social)
--   Un membre validé organise une rencontre (sur place ou en ligne), avec
--   le cercle de visibilité habituel ; les autres répondent « J'y vais » ou
--   « Peut-être » ; commentaires, signalement, masquage ; photos des
--   participants une fois l'événement passé. Notifications : à la création
--   (cercle), la veille (à ceux qui ont répondu), changement de date/lieu ou
--   annulation (idem). Un événement créé par un délégué ou un admin porte la
--   marque « Amicale ».
--   Rejouable.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tables
-- ------------------------------------------------------------
create table if not exists evenements (
  id             bigserial primary key,
  organisateur   uuid not null references profiles(id) on delete cascade,
  titre          text not null check (char_length(btrim(titre)) between 3 and 120),
  description    text not null default '' check (char_length(description) <= 2000),
  debut          timestamptz not null,
  fin            timestamptz check (fin is null or fin > debut),
  lieu_type      text not null default 'sur_place' check (lieu_type in ('sur_place', 'en_ligne')),
  ville          text not null default '' check (char_length(ville) <= 80),
  pays           text not null default '' check (char_length(pays) <= 2),
  adresse        text not null default '' check (char_length(adresse) <= 200),
  lien           text not null default '' check (char_length(lien) <= 300),
  affiche_chemin text,
  visibilite     text not null default 'tous' check (visibilite in ('tous', 'promo', 'domaine')),
  officiel       boolean not null default false,
  annule         boolean not null default false,
  masque         boolean not null default false,
  masque_par     uuid references profiles(id),
  rappel_envoye  boolean not null default false,
  cree_le        timestamptz not null default now(),
  maj_le         timestamptz not null default now()
);
create index if not exists evenements_debut_idx on evenements (debut);
grant select, insert, update, delete on evenements to authenticated;
grant usage, select on sequence evenements_id_seq to authenticated;
alter table evenements enable row level security;

create table if not exists evenement_reponses (
  evenement_id bigint not null references evenements(id) on delete cascade,
  membre       uuid not null references profiles(id) on delete cascade,
  reponse      text not null check (reponse in ('oui', 'peut_etre')),
  cree_le      timestamptz not null default now(),
  primary key (evenement_id, membre)
);
grant select, insert, update, delete on evenement_reponses to authenticated;
alter table evenement_reponses enable row level security;

create table if not exists evenement_photos (
  id           bigserial primary key,
  evenement_id bigint not null references evenements(id) on delete cascade,
  auteur       uuid not null references profiles(id) on delete cascade,
  chemin       text not null,                 -- bucket medias : <uuid>/evt-<id>-<horodatage>.jpg
  cree_le      timestamptz not null default now()
);
grant select, insert, delete on evenement_photos to authenticated;
grant usage, select on sequence evenement_photos_id_seq to authenticated;
alter table evenement_photos enable row level security;

-- marque « Amicale » posée d'office pour un délégué ou un admin ; textes nettoyés
create or replace function evenements_avant_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.titre := btrim(new.titre);
  new.description := btrim(coalesce(new.description, ''));
  new.officiel := (select role in ('delegue', 'admin') from profiles where id = new.organisateur);
  return new;
end $$;
drop trigger if exists evenements_avant_insert on evenements;
create trigger evenements_avant_insert before insert on evenements
  for each row execute function evenements_avant_insert();

create or replace function evenements_avant_update() returns trigger
language plpgsql as $$
begin
  new.titre := btrim(new.titre);
  new.maj_le := now();
  -- la modération et la marque ne se changent pas par une mise à jour ordinaire
  if not est_moderateur() then new.masque := old.masque; new.masque_par := old.masque_par; end if;
  new.officiel := old.officiel;
  -- date déplacée : le rappel de la veille repart
  if new.debut <> old.debut then new.rappel_envoye := false; end if;
  return new;
end $$;
drop trigger if exists evenements_avant_update on evenements;
create trigger evenements_avant_update before update on evenements
  for each row execute function evenements_avant_update();

-- ------------------------------------------------------------
-- 2. Politiques
-- ------------------------------------------------------------
drop policy if exists evenements_lecture on evenements;
create policy evenements_lecture on evenements
  for select to authenticated
  using (mon_statut() = 'valide'
         and (not masque or organisateur = auth.uid() or est_moderateur())
         and dans_le_cercle(organisateur, visibilite));
drop policy if exists evenements_insertion on evenements;
create policy evenements_insertion on evenements
  for insert to authenticated
  with check (mon_statut() = 'valide' and organisateur = auth.uid());
drop policy if exists evenements_modification on evenements;
create policy evenements_modification on evenements
  for update to authenticated
  using (organisateur = auth.uid() or est_moderateur())
  with check (organisateur = auth.uid() or est_moderateur());
drop policy if exists evenements_suppression on evenements;
create policy evenements_suppression on evenements
  for delete to authenticated
  using (organisateur = auth.uid() or est_admin());

-- réponses : visibles par ceux qui voient l'événement ; chacun la sienne
drop policy if exists evenement_reponses_lecture on evenement_reponses;
create policy evenement_reponses_lecture on evenement_reponses
  for select to authenticated
  using (exists (select 1 from evenements e where e.id = evenement_id));
drop policy if exists evenement_reponses_ecriture on evenement_reponses;
create policy evenement_reponses_ecriture on evenement_reponses
  for insert to authenticated
  with check (mon_statut() = 'valide' and membre = auth.uid()
              and exists (select 1 from evenements e where e.id = evenement_id and not e.annule));
drop policy if exists evenement_reponses_modification on evenement_reponses;
create policy evenement_reponses_modification on evenement_reponses
  for update to authenticated using (membre = auth.uid()) with check (membre = auth.uid());
drop policy if exists evenement_reponses_suppression on evenement_reponses;
create policy evenement_reponses_suppression on evenement_reponses
  for delete to authenticated using (membre = auth.uid());

-- photos : ceux qui voient l'événement ; ajout par l'organisateur ou un participant (« J'y vais »)
drop policy if exists evenement_photos_lecture on evenement_photos;
create policy evenement_photos_lecture on evenement_photos
  for select to authenticated
  using (exists (select 1 from evenements e where e.id = evenement_id));
drop policy if exists evenement_photos_insertion on evenement_photos;
create policy evenement_photos_insertion on evenement_photos
  for insert to authenticated
  with check (mon_statut() = 'valide' and auteur = auth.uid()
              and exists (select 1 from evenements e where e.id = evenement_id
                            and (e.organisateur = auth.uid()
                                 or exists (select 1 from evenement_reponses r where r.evenement_id = e.id and r.membre = auth.uid() and r.reponse = 'oui'))));
drop policy if exists evenement_photos_suppression on evenement_photos;
create policy evenement_photos_suppression on evenement_photos
  for delete to authenticated
  using (auteur = auth.uid() or est_admin()
         or exists (select 1 from evenements e where e.id = evenement_id and e.organisateur = auth.uid()));

-- commentaires et signalements sur un événement
alter table commentaires drop constraint if exists commentaires_cible_type_check;
alter table commentaires add constraint commentaires_cible_type_check
  check (cible_type in ('publication', 'offre', 'evenement'));
drop policy if exists commentaires_insertion on commentaires;
create policy commentaires_insertion on commentaires
  for insert to authenticated
  with check (mon_statut() = 'valide' and auteur = auth.uid()
              and (cible_type = 'offre'
                   or (cible_type = 'publication' and exists (select 1 from publications where id::text = cible_id))
                   or (cible_type = 'evenement' and exists (select 1 from evenements where id::text = cible_id))));
alter table signalements drop constraint if exists signalements_cible_type_check;
alter table signalements add constraint signalements_cible_type_check
  check (cible_type in ('publication', 'commentaire', 'offre', 'message', 'question', 'reponse', 'moment', 'evenement'));

-- ------------------------------------------------------------
-- 3. Lecture
-- ------------------------------------------------------------
create or replace function evenement_json(e evenements) returns json
language sql stable security invoker set search_path = public as $$
  select json_build_object(
    'id', e.id, 'titre', e.titre, 'description', e.description, 'debut', e.debut, 'fin', e.fin,
    'lieu_type', e.lieu_type, 'ville', e.ville, 'pays', e.pays, 'adresse', e.adresse, 'lien', e.lien,
    'affiche_chemin', e.affiche_chemin, 'visibilite', e.visibilite, 'officiel', e.officiel, 'annule', e.annule,
    'masque', e.masque, 'cree_le', e.cree_le, 'maj_le', e.maj_le,
    'organisateur', (select json_build_object('id', p.id, 'prenom', p.prenom, 'nom', p.nom, 'photo_url', p.photo_url,
                                               'promo', (select numero from promotions where id = p.promotion_id))
                       from profiles p where p.id = e.organisateur),
    'nb_oui', (select count(*) from evenement_reponses r where r.evenement_id = e.id and r.reponse = 'oui'),
    'nb_peut_etre', (select count(*) from evenement_reponses r where r.evenement_id = e.id and r.reponse = 'peut_etre'),
    'ma_reponse', (select reponse from evenement_reponses r where r.evenement_id = e.id and r.membre = auth.uid()),
    'nb_commentaires', (select count(*) from commentaires c where c.cible_type = 'evenement' and c.cible_id = e.id::text and not c.masque),
    'nb_photos', (select count(*) from evenement_photos f where f.evenement_id = e.id),
    'est_moi', e.organisateur = auth.uid()
  )
$$;
revoke all on function evenement_json(evenements) from public, anon;
grant execute on function evenement_json(evenements) to authenticated;

-- la liste : « a_venir » (du plus proche au plus lointain), « passes » (du plus récent)
create or replace function liste_evenements(p_quand text default 'a_venir', p_limite integer default 20, p_avant timestamptz default null)
returns json language sql stable security invoker set search_path = public as $$
  select coalesce(json_agg(evenement_json(e) order by
           case when p_quand = 'passes' then null else e.debut end asc,
           case when p_quand = 'passes' then e.debut else null end desc), '[]'::json)
  from (
    select * from evenements e
    where case when p_quand = 'passes'
               then coalesce(e.fin, e.debut + interval '3 hours') < now() and (p_avant is null or e.debut < p_avant)
               else coalesce(e.fin, e.debut + interval '3 hours') >= now() and (p_avant is null or e.debut > p_avant) end
    order by case when p_quand = 'passes' then null else e.debut end asc,
             case when p_quand = 'passes' then e.debut else null end desc
    limit least(coalesce(p_limite, 20), 50)
  ) e
$$;
revoke all on function liste_evenements(text, integer, timestamptz) from public, anon;
grant execute on function liste_evenements(text, integer, timestamptz) to authenticated;

-- un événement : la fiche, les participants, les photos
create or replace function lire_evenement(p_id bigint) returns json
language sql stable security invoker set search_path = public as $$
  select evenement_json(e)::jsonb
      || jsonb_build_object(
           'participants', (select coalesce(json_agg(json_build_object('id', p.id, 'prenom', p.prenom, 'nom', p.nom, 'photo_url', p.photo_url, 'reponse', r.reponse)
                                              order by r.reponse, r.cree_le), '[]'::json)
                              from evenement_reponses r join profiles p on p.id = r.membre where r.evenement_id = e.id),
           'photos', (select coalesce(json_agg(json_build_object('id', f.id, 'chemin', f.chemin, 'auteur', f.auteur, 'cree_le', f.cree_le) order by f.cree_le), '[]'::json)
                        from evenement_photos f where f.evenement_id = e.id))
    from evenements e where e.id = p_id
$$;
revoke all on function lire_evenement(bigint) from public, anon;
grant execute on function lire_evenement(bigint) to authenticated;

-- ------------------------------------------------------------
-- 4. Modération
-- ------------------------------------------------------------
create or replace function moderer_evenement(p_id bigint, p_masque boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if not est_moderateur() then raise exception 'Réservé aux délégués et administrateurs.'; end if;
  update evenements set masque = p_masque, masque_par = case when p_masque then auth.uid() end
   where id = p_id returning organisateur into v_org;
  if v_org is null then raise exception 'Événement introuvable.'; end if;
  update signalements set traite_le = now(), traite_par = auth.uid()
   where cible_type = 'evenement' and cible_id = p_id::text and traite_le is null;
  perform journaliser(case when p_masque then 'masquage_evenement' else 'retablissement_evenement' end,
                      v_org, jsonb_build_object('evenement', p_id));
end $$;
revoke all on function moderer_evenement(bigint, boolean) from public, anon;
grant execute on function moderer_evenement(bigint, boolean) to authenticated;

-- ------------------------------------------------------------
-- 5. Notifications
-- ------------------------------------------------------------
create or replace function evenement_quand(e evenements) returns text
language sql immutable as $$
  select to_char(e.debut at time zone 'Africa/Ouagadougou', 'DD/MM à HH24"h"MI')
$$;

-- création → le cercle
create or replace function push_evenement() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_qui text; v_promo int; v_domaine text; cibles uuid[];
begin
  select prenom || ' ' || nom, promotion_id, domaine into v_qui, v_promo, v_domaine from profiles where id = new.organisateur;
  select array_agg(id) into cibles from profiles
   where statut_compte = 'valide' and id <> new.organisateur
     and (new.visibilite = 'tous'
          or (new.visibilite = 'promo'   and promotion_id = v_promo)
          or (new.visibilite = 'domaine' and domaine = v_domaine));
  if cibles is not null then
    perform envoyer_push_liste(cibles,
      case when new.officiel then 'Événement de l''amicale : ' else v_qui || ' organise : ' end || new.titre,
      'Le ' || evenement_quand(new) || case when new.lieu_type = 'en_ligne' then ' · en ligne' when new.ville <> '' then ' · ' || new.ville else '' end,
      '/evenements/' || new.id, 'fil', 'evt-' || new.id);
  end if;
  return new;
end $$;
drop trigger if exists evenements_push on evenements;
create trigger evenements_push after insert on evenements
  for each row execute function push_evenement();

-- changement de date ou de lieu, annulation → ceux qui ont répondu
create or replace function push_evenement_maj() returns trigger
language plpgsql security definer set search_path = public as $$
declare cibles uuid[]; v_titre text; v_corps text;
begin
  if new.annule and not old.annule then
    v_titre := 'Annulé : ' || new.titre; v_corps := 'L''organisateur a annulé cet événement.';
  elsif new.debut <> old.debut then
    v_titre := 'Nouvelle date : ' || new.titre; v_corps := 'Désormais le ' || evenement_quand(new) || '.';
  elsif new.lieu_type <> old.lieu_type or new.ville <> old.ville or new.adresse <> old.adresse or new.lien <> old.lien then
    v_titre := 'Nouveau lieu : ' || new.titre;
    v_corps := case when new.lieu_type = 'en_ligne' then 'En ligne' else concat_ws(', ', nullif(new.adresse, ''), nullif(new.ville, '')) end;
  else
    return new;
  end if;
  select array_agg(membre) into cibles from evenement_reponses where evenement_id = new.id and membre <> new.organisateur;
  if cibles is not null then
    perform envoyer_push_liste(cibles, v_titre, v_corps, '/evenements/' || new.id, 'mes_demandes', 'evt-maj-' || new.id);
  end if;
  return new;
end $$;
drop trigger if exists evenements_push_maj on evenements;
create trigger evenements_push_maj after update on evenements
  for each row execute function push_evenement_maj();

-- la veille (entre 6 h et 30 h avant), à ceux qui ont répondu — cron chaque heure
create or replace function rappel_evenements() returns integer
language plpgsql security definer set search_path = public as $$
declare e evenements; cibles uuid[]; n integer := 0;
begin
  for e in select * from evenements
            where not annule and not masque and not rappel_envoye
              and debut between now() + interval '6 hours' and now() + interval '30 hours'
  loop
    select array_agg(membre) into cibles from evenement_reponses where evenement_id = e.id;
    if cibles is not null then
      perform envoyer_push_liste(cibles, 'C''est demain : ' || e.titre,
        'Le ' || evenement_quand(e) || case when e.lieu_type = 'en_ligne' then ' · en ligne' when e.ville <> '' then ' · ' || e.ville else '' end,
        '/evenements/' || e.id, 'mes_demandes', 'evt-rappel-' || e.id);
    end if;
    update evenements set rappel_envoye = true where id = e.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function rappel_evenements() from public, anon, authenticated;
select cron.schedule('rappel-evenements', '5 * * * *', $$select rappel_evenements()$$);

-- réponse « J'y vais » → l'organisateur (regroupé par événement)
create or replace function push_reponse_evenement() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_titre text; v_qui text; v_n int;
begin
  if new.reponse <> 'oui' then return new; end if;
  select organisateur, titre into v_org, v_titre from evenements where id = new.evenement_id;
  if v_org is null or v_org = new.membre then return new; end if;
  select prenom || ' ' || nom into v_qui from profiles where id = new.membre;
  select count(*) into v_n from evenement_reponses where evenement_id = new.evenement_id and reponse = 'oui';
  perform envoyer_push_liste(array[v_org], v_qui || ' vient : ' || v_titre,
    v_n || ' participant' || case when v_n > 1 then 's' else '' end || ' pour l''instant',
    '/evenements/' || new.evenement_id, 'mes_demandes', 'evt-rep-' || new.evenement_id);
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists evenement_reponses_push on evenement_reponses;
create trigger evenement_reponses_push after insert or update of reponse on evenement_reponses
  for each row execute function push_reponse_evenement();

-- commentaires : l'organisateur est prévenu ; « a aussi commenté » pour les autres
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
  elsif new.cible_type = 'evenement' then
    select organisateur into v_cible from evenements where id = new.cible_id::bigint;
    v_titre := v_qui || ' a commenté ton événement';
    v_url   := '/evenements/' || new.cible_id;
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

create or replace function push_commentaire_participants() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_qui text; v_proprio uuid; v_nom_proprio text; v_repond uuid; cibles uuid[]; v_url text; v_quoi text;
begin
  select prenom || ' ' || nom into v_qui from profiles where id = new.auteur;
  if new.cible_type = 'publication' then
    select auteur into v_proprio from publications where id = new.cible_id::bigint;
    v_url := '/publication/' || new.cible_id; v_quoi := 'la publication';
  elsif new.cible_type = 'evenement' then
    select organisateur into v_proprio from evenements where id = new.cible_id::bigint;
    v_url := '/evenements/' || new.cible_id; v_quoi := 'l''événement';
  else
    select posteur into v_proprio from offres where id = new.cible_id::bigint;
    v_url := '/offres/' || new.cible_id; v_quoi := 'l''offre';
  end if;
  if new.reponse_a is not null then select auteur into v_repond from commentaires where id = new.reponse_a; end if;
  select prenom into v_nom_proprio from profiles where id = v_proprio;
  select array_agg(distinct auteur) into cibles from commentaires
   where cible_type = new.cible_type and cible_id = new.cible_id and not masque
     and auteur <> new.auteur and auteur is distinct from v_proprio and auteur is distinct from v_repond
     and not (auteur = any(coalesce(new.mentions, '{}')));
  if cibles is not null then
    perform envoyer_push_liste(cibles,
      v_qui || ' a aussi commenté ' || v_quoi || case when v_nom_proprio is not null then ' de ' || v_nom_proprio else '' end,
      left(new.texte, 100), v_url, 'fil', 'com-' || new.cible_type || '-' || new.cible_id);
  end if;
  return new;
end $$;

-- signalement : le libellé
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
        when 'evenement'   then 'un événement'
        else 'une offre' end
      || ' : ' || left(new.motif, 100), '/admin', null);
  end if;
  return new;
end $$;

-- ------------------------------------------------------------
-- 6. Registre des fonctions ouvertes (contrôle de santé)
-- ------------------------------------------------------------
insert into sante_fonctions_ouvertes (nom, raison) values
  ('evenement_json',    'événements : une fiche en JSON (interne aux lectures)'),
  ('liste_evenements',  'événements : à venir ou passés'),
  ('lire_evenement',    'événements : la fiche, les participants, les photos'),
  ('moderer_evenement', 'modération : masquer/rétablir un événement (journalisé)')
on conflict (nom) do nothing;

-- Vérifications (une instruction à la fois) :
--   select count(*) from pg_policies where tablename in ('evenements', 'evenement_reponses', 'evenement_photos');   -- 11
--   select jobname from cron.job where jobname = 'rappel-evenements';
--   select liste_evenements('a_venir');   -- []
