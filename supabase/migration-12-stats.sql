-- ============================================================
-- Migration 12 — V2.3 : stats publiques enrichies (accueil)
-- Ajoute la répartition par pays et par promotion aux agrégats
-- anonymes existants. Toujours AUCUNE donnée personnelle : des
-- comptes validés, comptés en groupe, c'est tout.
-- ============================================================

create or replace function stats_publiques()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'anciens',    (select count(*) from profiles where statut_compte = 'valide'),
    'pays',       (select count(distinct pays) from profiles where statut_compte = 'valide' and pays is not null),
    'promotions', (select count(*) from promotions),
    'par_domaine', (select coalesce(json_object_agg(domaine, n), '{}'::json)
                    from (select domaine, count(*) n from profiles
                          where statut_compte = 'valide' group by domaine) d),
    'par_pays',    (select coalesce(json_object_agg(pays, n), '{}'::json)
                    from (select pays, count(*) n from profiles
                          where statut_compte = 'valide' and pays is not null
                          group by pays) p),
    'par_promo',   (select coalesce(json_object_agg(pr.numero, coalesce(c.n, 0)), '{}'::json)
                    from promotions pr
                    left join (select promotion_id, count(*) n from profiles
                               where statut_compte = 'valide' group by promotion_id) c
                      on c.promotion_id = pr.id)
  );
$$;

grant execute on function stats_publiques() to anon, authenticated;
