-- Migration 50 — lister TOUS les comptes dont l'email n'a jamais été confirmé.
--
-- La migration 49 a aligné le compteur « comptes fantômes » sur la vraie règle
-- de la purge : il est tombé de 7 à 0, car ces 7 comptes avaient été validés
-- par un délégué (jamais purgés, migration 37). Mais ce sont justement eux
-- qu'un admin veut voir : un membre validé dont l'email n'est pas confirmé
-- peut ne pas réussir à se connecter. D'où une liste sans condition de durée,
-- chaque compte portant son statut et l'indication « sera purgé » ou non.
--
-- ① admin_liste_non_confirmes() : tous les comptes à email non confirmé.
-- ② admin_etat_systeme() : ajoute le compteur 'non_confirmes' (le reste inchangé
--    depuis la migration 49).
-- ③ la nouvelle fonction est déclarée dans sante_fonctions_ouvertes (sinon le
--    contrôle de santé mensuel la signalerait comme « fonction ouverte »).
--
-- Aucune table créée ni modifiée : les droits des tables ne sont pas concernés.
-- Rejouable. ⚠ À exécuter sur le projet Supabase LSNO Amicale (pdjbqdwurwgxzghehldr).

-- ---------- ① la liste ----------
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
                           and coalesce(p.statut_compte, '') <> 'valide'
           ) order by u.created_at desc)
      from auth.users u
      left join profiles p    on p.id = u.id
      left join promotions pr on pr.id = p.promotion_id
     where u.email_confirmed_at is null
  ), '[]'::json);
end $$;

revoke all on function admin_liste_non_confirmes() from public, anon;
grant execute on function admin_liste_non_confirmes() to authenticated;

-- ---------- ② le compteur ----------
create or replace function admin_etat_systeme() returns json
language plpgsql security definer set search_path = public as $$
begin
  if not est_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  return json_build_object(
    'jobs', (
      select coalesce(json_agg(json_build_object(
        'nom', j.jobname,
        'planification', j.schedule,
        'derniere', (
          select json_build_object('quand', r.start_time, 'statut', r.status)
          from cron.job_run_details r
          where r.jobid = j.jobid
          order by r.start_time desc limit 1
        )
      ) order by j.jobname), '[]'::json)
      from cron.job j
    ),
    'fantomes', (
      select count(*) from auth.users u
      where u.email_confirmed_at is null and u.created_at < now() - interval '30 days'
        and not exists (select 1 from profiles v where v.id = u.id and v.statut_compte = 'valide')
    ),
    'non_confirmes', (
      select count(*) from auth.users u where u.email_confirmed_at is null
    ),
    'offres_expirent_14j', (
      select count(*) from offres
      where statut = 'active'
        and date_limite between current_date and current_date + 14
    )
  );
end $$;

revoke all on function admin_etat_systeme() from public, anon;
grant execute on function admin_etat_systeme() to authenticated;

-- ---------- ③ déclarée au contrôle de santé ----------
insert into sante_fonctions_ouvertes (nom, raison) values
  ('admin_liste_non_confirmes', 'back-office : comptes à email non confirmé (migration 50)')
on conflict (nom) do update set raison = excluded.raison;

-- Vérification (une seule instruction, lisible dans l'éditeur SQL) :
--   select * from sante_systeme where verdict like 'PROBL%';   -- rien = tout va bien
