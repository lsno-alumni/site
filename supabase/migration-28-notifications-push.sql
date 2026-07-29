-- ============================================================
-- Migration 28 — NOTIFICATIONS PUSH (socle)
--   Chaque appareil qui accepte les notifications enregistre ici son
--   « abonnement » (adresse d'envoi + clés de chiffrement fournies par le
--   navigateur). L'envoi réel est fait par la route /api/push du site
--   (auto-hébergé sur Vercel : signature VAPID + chiffrement), appelée par
--   la base via pg_net — même principe que les emails Brevo.
--
-- ⚠ AVANT D'EXÉCUTER : remplacer COLLE_LE_SECRET_PUSH_ICI par la valeur
--   PUSH_SECRET (fichier « cles-push.txt », à mettre aussi dans les
--   variables d'environnement Vercel). Il authentifie les appels base → site.
-- ============================================================

create extension if not exists pg_net;

-- ---------- abonnements des appareils ----------
create table if not exists push_abonnements (
  id         bigserial primary key,
  profil     uuid not null references profiles(id) on delete cascade,
  endpoint   text not null unique,      -- adresse d'envoi propre au navigateur
  p256dh     text not null,             -- clés de chiffrement du navigateur
  auth       text not null,
  appareil   text,                      -- user-agent abrégé (pour s'y retrouver)
  cree_le    timestamptz not null default now()
);
create index if not exists push_abonnements_profil_idx on push_abonnements(profil);

grant select, insert, delete on push_abonnements to authenticated;
grant usage, select on sequence push_abonnements_id_seq to authenticated;

alter table push_abonnements enable row level security;

-- chacun ne voit et ne gère QUE ses propres appareils
create policy push_abo_lecture on push_abonnements
  for select to authenticated using (profil = auth.uid());
create policy push_abo_ajout on push_abonnements
  for insert to authenticated with check (profil = auth.uid());
create policy push_abo_suppression on push_abonnements
  for delete to authenticated using (profil = auth.uid());

-- ---------- préférences par membre ----------
-- 4 familles pour éviter la fatigue de notification ; tout est actif par défaut.
alter table profiles
  add column if not exists push_mes_demandes boolean not null default true,
  add column if not exists push_reseau       boolean not null default true,
  add column if not exists push_offres       boolean not null default true,
  add column if not exists push_annonces     boolean not null default true;

-- rappel du piège maison : le SELECT sur profiles est une LISTE FERMÉE
grant select (push_mes_demandes, push_reseau, push_offres, push_annonces) on profiles to authenticated;
grant update (push_mes_demandes, push_reseau, push_offres, push_annonces) on profiles to authenticated;

-- ---------- secret partagé base → site ----------
select vault.create_secret('COLLE_LE_SECRET_PUSH_ICI', 'push_secret')
  on conflict do nothing;

-- ---------- envoi d'une notification à UN membre ----------
-- famille : 'mes_demandes' | 'reseau' | 'offres' | 'annonces' (ou null = toujours)
-- Ne bloque jamais l'action d'origine (même principe que envoyer_email).
create or replace function envoyer_push(
  p_profil uuid, p_titre text, p_corps text, p_url text default '/', p_famille text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  cle text;
  ok  boolean;
begin
  -- la famille est-elle acceptée par ce membre ?
  if p_famille is not null then
    execute format('select coalesce(push_%I, true) from profiles where id = $1', p_famille)
      into ok using p_profil;
    if not coalesce(ok, true) then return; end if;
  end if;

  -- a-t-il au moins un appareil abonné ?
  if not exists (select 1 from push_abonnements where profil = p_profil) then return; end if;

  select decrypted_secret into cle from vault.decrypted_secrets where name = 'push_secret';
  if cle is null then return; end if;

  perform net.http_post(
    url     := 'https://lsno-alumni.vercel.app/api/push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cle-push', cle),
    body    := jsonb_build_object('profil', p_profil, 'titre', p_titre,
                                  'corps', p_corps, 'url', p_url));
exception when others then
  null;  -- un échec de notification ne doit jamais faire échouer l'action
end $$;

revoke all on function envoyer_push(uuid, text, text, text, text) from public, anon, authenticated;

-- ---------- test depuis l'interface (admins) ----------
create or replace function admin_test_push() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not est_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  perform envoyer_push(auth.uid(), 'Test de notification',
    'Si tu lis ceci, les notifications fonctionnent.', '/admin');
end $$;
