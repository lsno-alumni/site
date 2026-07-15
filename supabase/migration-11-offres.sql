-- ============================================================
-- Migration 11 — V2.2 : OFFRES & OPPORTUNITÉS
--   Stages, emplois, bourses, cooptations, concours postés par les
--   membres validés (publication libre, signée du profil).
--   Expiration : date limite dépassée, ou 60 jours sans date limite
--   (filtrée à la lecture). Retrait possible par le posteur ou un admin.
-- ============================================================

create type type_offre as enum ('stage', 'emploi', 'bourse', 'cooptation', 'concours', 'autre');
create type statut_offre as enum ('active', 'cloturee');

create table offres (
  id          bigserial primary key,
  posteur     uuid not null references profiles(id) on delete cascade,
  type        type_offre not null,
  titre       text not null check (char_length(titre) <= 90),
  description text not null check (char_length(description) <= 600),
  domaine     text not null default 'autre',
  pays        text,
  ville       text,
  date_limite date,
  lien        text,
  statut      statut_offre not null default 'active',
  cree_le     timestamptz not null default now(),
  maj_le      timestamptz not null default now()
);

grant select, insert, update, delete on offres to authenticated;
grant usage, select on sequence offres_id_seq to authenticated;

alter table offres enable row level security;

-- lecture : membres validés
create policy offres_lecture on offres
  for select to authenticated
  using ((select statut_compte from profiles where id = auth.uid()) = 'valide');

-- publication : en son nom, compte validé
create policy offres_insertion on offres
  for insert to authenticated
  with check (
    posteur = auth.uid()
    and (select statut_compte from profiles where id = auth.uid()) = 'valide'
  );

-- modification/clôture : le posteur ; les admins aussi (modération)
create policy offres_maj on offres
  for update to authenticated
  using (posteur = auth.uid()
         or (select role from profiles where id = auth.uid()) = 'admin');

-- suppression : le posteur ou un admin
create policy offres_suppression on offres
  for delete to authenticated
  using (posteur = auth.uid()
         or (select role from profiles where id = auth.uid()) = 'admin');

create or replace function offres_maj_horodate() returns trigger
language plpgsql as $$
begin
  new.maj_le := now();
  return new;
end $$;
create trigger offres_horodate before update on offres
  for each row execute function offres_maj_horodate();
