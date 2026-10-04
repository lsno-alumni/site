-- Migration 85 (05/10/2026) : fréquentation, pour les admins.
-- Une visite = un membre, un jour, rien d'autre (table visites, clé membre+jour, aucun droit de
-- table : tout passe par deux fonctions). L'appli note la visite une fois par jour à l'ouverture
-- (noter_visite) ; l'onglet Validation des admins lit admin_frequentation() : actifs du jour,
-- de la semaine, du mois, courbe sur 30 jours, taux de profils complets (profil_complet, 84).
-- Purge au-delà de 400 jours, dans le cron quotidien existant. Pas de nouveaux inscrits,
-- publications, messages ni documents ici : non demandés.

create table if not exists visites (
  membre uuid not null references profiles(id) on delete cascade,
  jour   date not null default current_date,
  primary key (membre, jour)
);
alter table visites enable row level security;
-- RLS active + une politique (exigence du contrôle de santé) ; aucun accès direct : les fonctions ci-dessous suffisent
drop policy if exists visites_aucun_acces_direct on visites;
create policy visites_aucun_acces_direct on visites for select to authenticated using (false);

-- la visite du jour (membre validé), silencieuse et idempotente
create or replace function noter_visite() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or mon_statut() is distinct from 'valide' then return; end if;
  insert into visites (membre, jour) values (auth.uid(), current_date) on conflict do nothing;
end $$;
revoke all on function noter_visite() from public, anon;
grant execute on function noter_visite() to authenticated;

-- la lecture, réservée aux administrateurs
create or replace function admin_frequentation() returns json
language plpgsql security definer set search_path = public as $$
declare r json;
begin
  if not est_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  select json_build_object(
    'jour',    (select count(*) from visites where jour = current_date),
    'semaine', (select count(distinct membre) from visites where jour > current_date - 7),
    'mois',    (select count(distinct membre) from visites where jour > current_date - 30),
    'courbe',  (select coalesce(json_agg(json_build_object('jour', d.j, 'actifs', coalesce(v.n, 0)) order by d.j), '[]'::json)
                  from (select generate_series(current_date - 29, current_date, interval '1 day')::date as j) d
                  left join (select jour, count(*) as n from visites where jour > current_date - 30 group by jour) v on v.jour = d.j),
    'valides',  (select count(*) from profiles where statut_compte = 'valide'),
    'complets', (select count(*) from profiles p where p.statut_compte = 'valide' and profil_complet(p.id)),
    'depuis',   (select min(jour) from visites)
  ) into r;
  return r;
end $$;
revoke all on function admin_frequentation() from public, anon;
grant execute on function admin_frequentation() to authenticated;

insert into sante_fonctions_ouvertes (nom, raison) values
  ('noter_visite', 'fréquentation : un membre validé note sa visite du jour (membre + jour, rien d''autre)'),
  ('admin_frequentation', 'fréquentation : actifs jour/semaine/mois, courbe 30 jours, profils complets — admins')
on conflict (nom) do nothing;

-- purge à 400 jours, dans le cron quotidien existant (même nom : la commande est remplacée)
select cron.schedule('push-rappels-quotidiens', '0 9 * * *',
  $$select push_rappels_quotidiens(); select relancer_profils_incomplets(); delete from visites where jour < current_date - 400;$$);

-- Vérification :
--   select noter_visite(); select admin_frequentation();   -- connecté en admin : jour = 1 au moins
--   select count(*) from information_schema.role_table_grants where table_name = 'visites';   -- 0 : aucun droit direct, voulu
