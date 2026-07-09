-- ============================================================
-- LSNO ALUMNI — schéma Supabase (PostgreSQL + RLS)
-- À exécuter dans l'éditeur SQL du projet Supabase.
-- ============================================================

-- ---------- types ----------
create type statut_compte as enum ('en_attente', 'valide', 'suspendu');
create type role_membre   as enum ('membre', 'delegue', 'admin');
create type visibilite    as enum ('membres', 'demande', 'masque');
create type situation_t   as enum ('etudiant', 'emploi', 'entrepreneur', 'recherche');

-- ---------- promotions ----------
create table promotions (
  id            serial primary key,
  numero        int  not null unique,          -- P1, P2, …
  annee_entree  int  not null,
  annee_bac     int  not null,
  etablissement text not null default 'LSNO'   -- extension future : 'LSBD' (Bobo)
);

insert into promotions (numero, annee_entree, annee_bac)
select n, 2016 + n, 2019 + n from generate_series(1, 9) as n;

-- ---------- profils ----------
create table profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  prenom         text not null,
  nom            text not null,
  photo_url      text,
  promotion_id   int  not null references promotions(id),
  domaine        text not null default 'autre',
  situation      situation_t not null default 'etudiant',
  statut_titre   text,                          -- ex. « Data scientist — M2 IA à Montréal »
  bio            text,
  conseil        text,                          -- conseil aux cadets
  repond_cadets  boolean not null default false,
  ville          text,
  pays           text,                          -- code ISO-2 (BF, MA, FR…)
  whatsapp       text,
  whatsapp_visi  visibilite not null default 'demande',
  email_contact  text,
  email_visi     visibilite not null default 'demande',
  linkedin       text,
  linkedin_visi  visibilite not null default 'membres',
  statut_compte  statut_compte not null default 'en_attente',
  role           role_membre  not null default 'membre',
  valide_par     uuid references profiles(id), -- traçabilité : qui a validé
  valide_le      timestamptz,
  cree_le        timestamptz not null default now(),
  maj_le         timestamptz not null default now()
);

-- ---------- parcours ----------
create table parcours (
  id          bigserial primary key,
  profile_id  uuid not null references profiles(id) on delete cascade,
  type_etape  text not null,                   -- prepa / licence / ecole / medecine / master / doctorat / emploi
  titre       text not null,
  etablissement text,
  pays        text,
  ville       text,
  annee_debut int,
  annee_fin   int,                             -- null = en cours
  ordre       int not null default 0
);

-- ============================================================
-- SÉCURITÉ (Row Level Security)
-- Principe : rien n'est visible sans compte validé ;
-- chacun n'écrit que chez soi ; délégués/admins valident.
-- ============================================================
alter table profiles enable row level security;
alter table parcours enable row level security;
alter table promotions enable row level security;

-- utilitaires
create or replace function mon_statut() returns statut_compte
language sql stable security definer as
$$ select statut_compte from profiles where id = auth.uid() $$;

create or replace function mon_role() returns role_membre
language sql stable security definer as
$$ select role from profiles where id = auth.uid() $$;

create or replace function ma_promotion() returns int
language sql stable security definer as
$$ select promotion_id from profiles where id = auth.uid() $$;

-- promotions : lisibles par tout utilisateur connecté (nécessaire à l'inscription)
create policy promotions_lecture on promotions
  for select to authenticated using (true);

-- profils : lecture réservée aux membres validés ; chacun se lit toujours lui-même
create policy profils_lecture on profiles
  for select to authenticated
  using (id = auth.uid() or (mon_statut() = 'valide' and statut_compte = 'valide'));

-- délégués : voient aussi les demandes en attente de LEUR promotion
create policy profils_lecture_delegue on profiles
  for select to authenticated
  using (mon_role() = 'delegue' and promotion_id = ma_promotion());

-- admins : voient tout
create policy profils_lecture_admin on profiles
  for select to authenticated
  using (mon_role() = 'admin');

-- création de son propre profil à l'inscription (toujours en_attente, role membre)
create policy profils_insertion on profiles
  for insert to authenticated
  with check (id = auth.uid() and statut_compte = 'en_attente' and role = 'membre');

-- chacun modifie son propre profil (sans toucher statut/role — colonnes protégées par trigger)
create policy profils_maj_soi on profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- délégués : valident/refusent les comptes de leur promotion ; admins : partout
create policy profils_maj_delegue on profiles
  for update to authenticated
  using (mon_role() = 'delegue' and promotion_id = ma_promotion());
create policy profils_maj_admin on profiles
  for update to authenticated
  using (mon_role() = 'admin');

-- suppression : soi-même (droit à l'effacement) ou admin
create policy profils_suppression on profiles
  for delete to authenticated
  using (id = auth.uid() or mon_role() = 'admin');

-- parcours : suit les droits du profil parent
create policy parcours_lecture on parcours
  for select to authenticated
  using (exists (select 1 from profiles p where p.id = profile_id));
create policy parcours_ecriture on parcours
  for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ---------- trigger : seuls délégués/admins changent statut_compte et role ----------
create or replace function protege_colonnes() returns trigger
language plpgsql security definer as $$
begin
  if (new.statut_compte is distinct from old.statut_compte
      or new.role is distinct from old.role) then
    if mon_role() not in ('delegue', 'admin') then
      raise exception 'Seuls les délégués et administrateurs peuvent modifier statut ou rôle.';
    end if;
    -- un délégué ne promeut pas au-delà de membre<->valide ; seuls les admins gèrent les rôles
    if new.role is distinct from old.role and mon_role() <> 'admin' then
      raise exception 'Seuls les administrateurs peuvent modifier les rôles.';
    end if;
    new.valide_par := auth.uid();
    new.valide_le  := now();
  end if;
  new.maj_le := now();
  return new;
end $$;

create trigger profiles_protege before update on profiles
  for each row execute function protege_colonnes();

-- ---------- création automatique du profil à l'inscription ----------
-- L'app passe prenom/nom/promotion/domaine dans les métadonnées de signUp ;
-- ce trigger crée le profil en_attente, même si l'email n'est pas encore confirmé.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, prenom, nom, promotion_id, domaine, email_contact)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'prenom', 'Prénom'),
    coalesce(new.raw_user_meta_data->>'nom', ''),
    (select id from promotions
      where numero = coalesce((new.raw_user_meta_data->>'promotion')::int, 1)),
    coalesce(new.raw_user_meta_data->>'domaine', 'autre'),
    new.email
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- statistiques publiques (page d'accueil, sans connexion) ----------
-- Uniquement des agrégats anonymes — aucun accès aux lignes.
create or replace function stats_publiques()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'anciens',    (select count(*) from profiles where statut_compte = 'valide'),
    'pays',       (select count(distinct pays) from profiles where statut_compte = 'valide' and pays is not null),
    'promotions', (select count(*) from promotions),
    'par_domaine', (select coalesce(json_object_agg(domaine, n), '{}'::json)
                    from (select domaine, count(*) n from profiles
                          where statut_compte = 'valide' group by domaine) d)
  );
$$;

grant execute on function stats_publiques() to anon, authenticated;

-- ============================================================
-- AMORÇAGE — après création de ton compte via l'app :
--   update profiles set role='admin', statut_compte='valide' where id='<ton-uuid>';
-- (à exécuter une seule fois dans l'éditeur SQL, en tant que propriétaire)
-- ============================================================
