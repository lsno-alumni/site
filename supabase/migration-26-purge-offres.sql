-- ============================================================
-- Migration 26 — PURGE mensuelle des offres clôturées (+ leurs fichiers)
--   Chaque 1er du mois : les offres « cloturee » depuis plus de 3 mois
--   sont supprimées définitivement, ainsi que leurs pièces jointes.
--
--   Les lignes offre_fichiers partent en cascade, MAIS les binaires du
--   Storage doivent être retirés via l'API (pg_cron/SQL ne peut pas le
--   faire seul) → on appelle l'API Storage avec pg_net + clé service_role.
--
-- ⚠ AVANT D'EXÉCUTER : remplacer COLLE_TA_CLE_SERVICE_ROLE_ICI ci-dessous
--   par la clé « service_role » (Dashboard → Settings → API → Project API
--   keys → service_role → Reveal). C'EST UNE CLÉ TRÈS PUISSANTE (contourne
--   la RLS) : elle ne vit que dans le Vault, jamais dans le code ni le dépôt.
-- ============================================================

create extension if not exists pg_net;

-- clé service_role rangée dans le coffre chiffré (Vault)
select vault.create_secret('COLLE_TA_CLE_SERVICE_ROLE_ICI', 'service_role_key');

create or replace function purge_offres_cloturees()
returns void language plpgsql security definer set search_path = public as $$
declare
  cle  text;
  base text := 'https://pdjbqdwurwgxzghehldr.supabase.co/storage/v1/object/ressources/';
  f    record;
begin
  select decrypted_secret into cle from vault.decrypted_secrets where name = 'service_role_key';

  -- 1) retirer du Storage les fichiers des offres clôturées depuis > 3 mois
  --    (pg_net est asynchrone : les requêtes sont mises en file, les URLs
  --     restent valides même après la suppression des lignes à l'étape 2)
  if cle is not null then
    for f in
      select of.chemin
      from offre_fichiers of
      join offres o on o.id = of.offre_id
      where o.statut = 'cloturee'
        and o.maj_le < now() - interval '3 months'
    loop
      perform net.http_delete(
        url     := base || f.chemin,
        headers := jsonb_build_object('Authorization', 'Bearer ' || cle, 'apikey', cle));
    end loop;
  end if;

  -- 2) supprimer les offres clôturées de plus de 3 mois
  --    (les lignes offre_fichiers disparaissent en cascade)
  delete from offres
   where statut = 'cloturee'
     and maj_le < now() - interval '3 months';
end $$;

-- fonction sensible (utilise la clé service_role) : personne ne l'appelle
-- via l'API, seul le cron (rôle postgres) l'exécute
revoke all on function purge_offres_cloturees() from public, anon, authenticated;

-- 1er du mois à 06:00 UTC (après les autres jobs mensuels de 05:xx)
select cron.schedule('purge-offres-cloturees', '0 6 1 * *',
  $$select purge_offres_cloturees()$$);
