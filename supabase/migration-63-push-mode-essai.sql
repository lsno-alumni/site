-- ============================================================
-- Migration 63 — mode essai des notifications
--   Pendant les essais (deux comptes de test sur la base de production),
--   chaque publication, question ou message de test poussait une notification
--   aux vrais membres. Interrupteur « push_mode_essai » (table reglages,
--   bouton dans l'onglet admin) : tant qu'il est actif, envoyer_push_liste ne
--   garde que les administrateurs et les comptes listés dans
--   push_essai_comptes. Éteint (défaut) : comportement inchangé.
--   Rejouable.
-- ============================================================
insert into reglages (cle, actif) values ('push_mode_essai', false)
  on conflict (cle) do nothing;

create table if not exists push_essai_comptes (
  profil   uuid primary key references profiles(id) on delete cascade,
  ajoute_le timestamptz not null default now()
);
alter table push_essai_comptes enable row level security;
-- lue seulement par envoyer_push_liste (security definer) : aucun droit direct
revoke all on push_essai_comptes from public, anon, authenticated;
grant select, insert, update, delete on push_essai_comptes to service_role;

-- le compte de test « Test Tester » (les admins sont gardés d'office)
insert into push_essai_comptes (profil)
  select u.id from auth.users u where lower(u.email) = 'simporetaobata@gmail.com'
  on conflict (profil) do nothing;

-- les cibles gardées quand le mode essai est actif (toutes sinon)
create or replace function push_cibles_essai(p_cibles uuid[]) returns uuid[]
language sql stable security definer set search_path = public as $$
  select case
    when coalesce((select actif from reglages where cle = 'push_mode_essai'), false)
    then (select array_agg(c) from unnest(p_cibles) c
           where c in (select id from profiles where role = 'admin')
              or c in (select profil from push_essai_comptes))
    else p_cibles end
$$;
revoke all on function push_cibles_essai(uuid[]) from public, anon, authenticated;

create or replace function envoyer_push_liste(
  p_profils uuid[], p_titre text, p_corps text, p_url text, p_famille text, p_groupe text, p_extra jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare
  cle    text;
  cibles uuid[];
  lot    uuid[];
  n      int;
begin
  if p_profils is null or array_length(p_profils, 1) is null then return; end if;
  select decrypted_secret into cle from vault.decrypted_secrets where name = 'push_secret';
  if cle is null then return; end if;
  if p_famille is null then
    select array_agg(distinct profil) into cibles from push_abonnements where profil = any(p_profils);
  else
    execute format($f$
      select array_agg(distinct a.profil)
        from push_abonnements a join profiles p on p.id = a.profil
       where a.profil = any($1) and coalesce(p.push_%I, true)
    $f$, p_famille) into cibles using p_profils;
  end if;
  cibles := push_cibles_essai(cibles);   -- mode essai : admins + comptes de test seulement
  while cibles is not null and array_length(cibles, 1) > 0 loop
    n := least(50, array_length(cibles, 1));
    lot := cibles[1:n];
    cibles := cibles[n + 1 : array_length(cibles, 1)];
    perform net.http_post(
      url     := 'https://lsno-alumni.vercel.app/api/push',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cle-push', cle),
      body    := jsonb_build_object('profils', to_jsonb(lot), 'titre', p_titre, 'corps', p_corps,
                                    'url', coalesce(p_url, '/'), 'famille', p_famille, 'groupe', p_groupe,
                                    'extra', coalesce(p_extra, '{}'::jsonb)));
  end loop;
exception when others then
  null;
end $$;
revoke all on function envoyer_push_liste(uuid[], text, text, text, text, text, jsonb) from public, anon, authenticated;

-- Vérification :
--   select cle, actif from reglages where cle = 'push_mode_essai';   -- false tant que les essais n'ont pas commencé
--   select count(*) from push_essai_comptes;                          -- 1 (le compte de test)
-- Activer / éteindre : bouton « Mode essai des notifications » dans l'onglet admin,
-- ou : update reglages set actif = true where cle = 'push_mode_essai';
