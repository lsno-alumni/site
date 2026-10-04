-- Essai au banc : fréquentation (migration 85).
--   npm run banc -- outils/banc/essai-frequentation.sql
-- Ana (admin, complète) et Bob (membre, incomplet) notent leur visite ; deux appels le même jour
-- ne comptent qu'une fois ; un compte non validé ne note rien ; Bob ne peut pas lire ;
-- Ana lit : jour 2, semaine 2 (plus une visite antidatée de Bob il y a 10 jours → mois 2),
-- courbe de 30 points, profils complets 1 sur 2 ; aucun droit de table ; cron à trois ordres.

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@essai', '{"prenom":"Ana","nom":"A","promotion":3}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@essai', '{"prenom":"Bob","nom":"B","promotion":3}'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@essai', '{"prenom":"Cat","nom":"C","promotion":3}');
update profiles set statut_compte = 'valide' where id in ('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002');
update profiles set role = 'admin', photo_url = 'https://x/a.jpg', statut_titre = 'Ingénieure', ville = 'Ouaga', pays = 'BF' where id = 'aaaaaaaa-0000-0000-0000-000000000001';

select set_config('essai.uid', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
select noter_visite(); select noter_visite();
reset role;
select set_config('essai.uid', 'bbbbbbbb-0000-0000-0000-000000000002', false);
set role authenticated;
select noter_visite();
do $$ begin
  perform admin_frequentation();
  raise exception 'ÉCHEC : un membre lit la fréquentation';
exception when others then
  if sqlerrm like '%ÉCHEC%' then raise; end if;
  raise notice 'ok : lecture refusée à un membre';
end $$;
reset role;
select set_config('essai.uid', 'cccccccc-0000-0000-0000-000000000003', false);
set role authenticated;
select noter_visite();   -- Cat n'est pas validée : rien
reset role;
select 'visites du jour : ' || count(*) || ' (attendu 2 : Ana une fois malgré deux appels, Bob ; Cat rien)' from visites where jour = current_date;
insert into visites (membre, jour) values ('bbbbbbbb-0000-0000-0000-000000000002', current_date - 10);

select set_config('essai.uid', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
select 'Ana lit : jour ' || (admin_frequentation()->>'jour') || ', semaine ' || (admin_frequentation()->>'semaine') || ', mois ' || (admin_frequentation()->>'mois')
    || ' (attendu 2, 2, 2) ; courbe ' || json_array_length(admin_frequentation()->'courbe') || ' points (attendu 30) ; dernier point = ' || (admin_frequentation()->'courbe'->29->>'actifs') || ' (attendu 2)';
select 'profils : ' || (admin_frequentation()->>'complets') || ' complet(s) sur ' || (admin_frequentation()->>'valides') || ' validés (attendu 1 sur 2)';
reset role;

-- conformité
select 'droits de table sur visites : ' || count(*) || ' (attendu 0)' from information_schema.role_table_grants where table_name = 'visites' and grantee in ('anon','authenticated');
select 'RLS + politique : ' || (select count(*) from pg_policies where tablename = 'visites') || ' politique(s) (attendu 1)';
select 'liste blanche : ' || count(*) || ' (attendu 2)' from sante_fonctions_ouvertes where nom in ('noter_visite','admin_frequentation');
select 'cron quotidien à trois ordres : ' || (select count(*) from cron.job where jobname = 'push-rappels-quotidiens' and command like '%delete from visites%') || ' (attendu 1)';
