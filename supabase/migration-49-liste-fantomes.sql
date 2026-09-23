-- Migration 49 — voir QUI sont les comptes fantômes, pas seulement combien.
--
-- L'onglet Validation affichait « Comptes fantômes à purger : N » sans
-- possibilité de savoir de qui il s'agit. Or c'est précisément la question
-- qu'un admin se pose avant la purge mensuelle : y a-t-il parmi eux quelqu'un
-- qu'on connaît, qui n'a simplement jamais retrouvé son email de confirmation ?
-- (on peut alors confirmer son email à la main dans « Gérer un membre »
-- avant qu'il ne soit supprimé).
--
-- ① admin_liste_fantomes() : exactement les comptes que la purge du 1er du
--    mois supprimera (même règle que purge_comptes_non_confirmes(), migration 37).
-- ② admin_etat_systeme() : le COMPTEUR n'appliquait pas le garde-fou de la
--    migration 37 (un compte validé par un délégué n'est jamais purgé, même
--    email non confirmé) — il pouvait donc annoncer plus de comptes que la
--    purge n'en supprime réellement, et ne plus correspondre à la liste.
-- ③ la nouvelle fonction est déclarée dans sante_fonctions_ouvertes, sinon le
--    contrôle de santé mensuel la signalerait comme « fonction ouverte ».
--
-- Aucune table créée ni modifiée (pas de DDL de table) : les droits des tables
-- existantes ne sont pas concernés. Rejouable.

-- ---------- ① la liste ----------
create or replace function admin_liste_fantomes() returns json
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
             'statut',    p.statut_compte
           ) order by u.created_at)
      from auth.users u
      left join profiles p    on p.id = u.id
      left join promotions pr on pr.id = p.promotion_id
     where u.email_confirmed_at is null
       and u.created_at < now() - interval '30 days'
       and not exists (select 1 from profiles v where v.id = u.id and v.statut_compte = 'valide')
  ), '[]'::json);
end $$;

revoke all on function admin_liste_fantomes() from public, anon;
grant execute on function admin_liste_fantomes() to authenticated;

-- ---------- ② le compteur, aligné sur la purge ----------
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
  ('admin_liste_fantomes', 'back-office : liste des comptes fantômes avant purge (migration 49)')
on conflict (nom) do update set raison = excluded.raison;

-- Vérification (une seule instruction, lisible dans l'éditeur SQL) :
--   select * from sante_systeme where verdict like 'PROBL%';   -- rien = tout va bien
