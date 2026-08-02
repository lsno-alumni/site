-- Prélude du banc d'essai : recrée ce que Supabase fournit et qu'un PostgreSQL
-- nu n'a pas. Sans lui, nos migrations échouent dès la première ligne qui parle
-- d'auth.uid(), du Vault ou de pg_cron.
--
-- Ce n'est PAS une imitation fidèle de Supabase : c'est le strict nécessaire pour
-- que les migrations s'exécutent et qu'on vérifie ce qui nous intéresse — les
-- tables, les colonnes, les politiques, les fonctions, les droits. Ce que le banc
-- ne peut pas juger : le comportement réel de l'authentification, l'envoi des
-- emails et des notifications (pg_net est un leurre), et la planification pg_cron.

-- ---------- les rôles ----------
create role anon;
create role authenticated;
create role service_role;
create role authenticator;
grant anon, authenticated, service_role to authenticator;

-- ---------- le schéma auth ----------
create schema if not exists auth;

create table auth.users (
  id                uuid primary key default gen_random_uuid(),
  email             text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  created_at        timestamptz not null default now(),
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create table auth.identities (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  provider      text,
  identity_data jsonb not null default '{}'::jsonb
);

create table auth.mfa_factors (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  friendly_name text,
  factor_type  text,
  status       text
);

-- L'identité de l'appelant. Dans Supabase elle vient du jeton ; ici on la pose
-- à la main dans les essais : select set_config('essai.uid', '<uuid>', false);
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('essai.uid', true), '')::uuid
$$;

create or replace function auth.jwt() returns jsonb
language sql stable as $$ select '{}'::jsonb $$;

-- ---------- le Vault ----------
create schema if not exists vault;
create table vault.secrets (
  id     uuid primary key default gen_random_uuid(),
  name   text unique,
  secret text
);
create view vault.decrypted_secrets as
  select id, name, secret as decrypted_secret from vault.secrets;
create or replace function vault.create_secret(p_secret text, p_name text default null)
returns uuid language sql as $$
  insert into vault.secrets (name, secret) values (p_name, p_secret)
  on conflict (name) do update set secret = excluded.secret returning id
$$;

-- ---------- pg_cron (leurre : on enregistre, on n'exécute rien) ----------
create schema if not exists cron;
create table cron.job (
  jobid    bigserial primary key,
  jobname  text unique,
  schedule text,
  command  text,
  active   boolean not null default true
);
create table cron.job_run_details (
  jobid      bigint,
  status     text,
  start_time timestamptz
);
create or replace function cron.schedule(p_nom text, p_quand text, p_commande text)
returns bigint language sql as $$
  insert into cron.job (jobname, schedule, command) values (p_nom, p_quand, p_commande)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command
  returning jobid
$$;
create or replace function cron.unschedule(p_nom text) returns boolean
language sql as $$ delete from cron.job where jobname = p_nom returning true $$;

-- ---------- pg_net (leurre : aucun appel réseau n'est fait) ----------
create schema if not exists net;
create or replace function net.http_post(
  url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb, timeout_milliseconds int default 5000
) returns bigint language sql as $$ select 1::bigint $$;

-- ---------- le schéma storage ----------
create schema if not exists storage;
create table storage.buckets (
  id text primary key, name text, public boolean default false
);
create table storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name      text,
  owner     uuid,
  metadata  jsonb not null default '{}'::jsonb
);
alter table storage.objects enable row level security;
insert into storage.buckets (id, name, public) values
  ('photos', 'photos', true), ('ressources', 'ressources', true)
on conflict do nothing;

-- ---------- extensions utilisées par les migrations ----------
create extension if not exists pgcrypto;
