-- ============================================================
-- Migration 33 — transmettre la FAMILLE dans la notification
--   Le service worker regroupe les notifications au-delà d'un seuil
--   (4 par défaut) pour les familles « reseau » et « offres » : les 3
--   premières restent individuelles, la 4e les remplace par un résumé
--   (« 4 nouveaux membres »). Pour cela il doit connaître la famille
--   → on l'ajoute au corps envoyé à /api/push.
--   Les familles « mes_demandes » et « annonces » ne sont jamais regroupées
--   (chaque message y compte individuellement).
-- ============================================================

create or replace function envoyer_push_liste(
  p_profils uuid[], p_titre text, p_corps text, p_url text default '/', p_famille text default null
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

  -- ne garder que ceux qui ont au moins un appareil abonné ET qui acceptent
  -- cette famille de notifications
  if p_famille is null then
    select array_agg(distinct profil) into cibles
      from push_abonnements where profil = any(p_profils);
  else
    execute format($f$
      select array_agg(distinct a.profil)
        from push_abonnements a join profiles p on p.id = a.profil
       where a.profil = any($1) and coalesce(p.push_%I, true)
    $f$, p_famille) into cibles using p_profils;
  end if;

  while cibles is not null and array_length(cibles, 1) > 0 loop
    n := least(50, array_length(cibles, 1));
    lot := cibles[1:n];
    cibles := cibles[n + 1 : array_length(cibles, 1)];
    perform net.http_post(
      url     := 'https://lsno-alumni.vercel.app/api/push',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cle-push', cle),
      body    := jsonb_build_object('profils', to_jsonb(lot), 'titre', p_titre,
                                    'corps', p_corps, 'url', coalesce(p_url, '/'),
                                    -- nouveau : permet le regroupement côté appareil
                                    'famille', p_famille));
  end loop;
exception when others then
  null;  -- une notification ne doit jamais faire échouer l'action d'origine
end $$;

revoke all on function envoyer_push_liste(uuid[], text, text, text, text) from public, anon, authenticated;
