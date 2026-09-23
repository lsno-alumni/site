-- Migration 51 — corrige admin_liste_non_confirmes() (migration 50).
--
-- La 50 calculait « sera purgé » avec coalesce(p.statut_compte, '') : or
-- statut_compte est une énumération ('en_attente', 'valide', 'suspendu'), et
-- la chaîne vide n'en fait pas partie. La fonction se créait sans erreur
-- (PL/pgSQL ne vérifie le corps qu'à l'appel) mais CHAQUE appel échouait :
--   invalid input value for enum statut_compte: ""
-- → la liste restait « indisponible » dans l'onglet Validation.
-- « is distinct from » traite le cas sans profil (NULL) sans rien convertir.
--
-- Rejouable. ⚠ À exécuter sur le projet Supabase LSNO Amicale (pdjbqdwurwgxzghehldr).

create or replace function admin_liste_non_confirmes() returns json
language plpgsql security definer set search_path = public, auth as $$
begin
  if not est_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  return coalesce((
    select json_agg(json_build_object(
             'email',     u.email,
             'cree_le',   u.created_at,
             'prenom',    p.prenom,
             'nom',       p.nom,
             'promotion', pr.numero,
             'statut',    p.statut_compte,
             -- même règle que purge_comptes_non_confirmes() (migration 37)
             'sera_purge', u.created_at < now() - interval '30 days'
                           and p.statut_compte is distinct from 'valide'
           ) order by u.created_at desc)
      from auth.users u
      left join profiles p    on p.id = u.id
      left join promotions pr on pr.id = p.promotion_id
     where u.email_confirmed_at is null
  ), '[]'::json);
end $$;

revoke all on function admin_liste_non_confirmes() from public, anon;
grant execute on function admin_liste_non_confirmes() to authenticated;

-- Vérification (une seule instruction) :
--   select * from sante_systeme where verdict like 'PROBL%';   -- rien = tout va bien
