-- Essai au banc : groupes qu'on peut rejoindre (migration 68).
--   npm run banc -- outils/banc/essai-groupes.sql
-- A (déléguée, promo 3) crée un groupe « sur demande » limité à sa promo :
-- marque Amicale ; B (promo 3) le voit, demande ; C (promo 2) ne le voit
-- pas ; A voit la demande, accepte → B membre ; un groupe ouvert se rejoint
-- d'un tap ; un refus bloque une nouvelle demande pendant 7 jours.

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@essai', '{"prenom":"Ana","nom":"A","promotion":3}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@essai', '{"prenom":"Bob","nom":"B","promotion":3}'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@essai', '{"prenom":"Cléo","nom":"C","promotion":2}');
update profiles set statut_compte = 'valide' where id in
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000003');
update profiles set role = 'delegue' where id = 'aaaaaaaa-0000-0000-0000-000000000001';

select set_config('essai.uid', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
select creer_groupe('Promo 3 à Ouaga', '{}'::uuid[]) as g1;
update conversations set acces = 'demande', visibilite = 'promo' where id = 1;
select creer_groupe('Foot du dimanche', '{}'::uuid[]) as g2;
update conversations set acces = 'ouvert' where id = 2;
select 'création' as essai, id, nom, acces, officiel from conversations order by id;
reset role;

select set_config('essai.uid', 'bbbbbbbb-0000-0000-0000-000000000002', false);
set role authenticated;
select 'B voit' as essai, json_array_length(groupes_visibles()) as groupes, (groupes_visibles('foot')->0->>'nom') as recherche;
select 'B demande' as essai, rejoindre_groupe(1) as resultat;
select 'B redemande (déjà en attente)' as essai, rejoindre_groupe(1) as resultat;
select 'B rejoint le groupe ouvert' as essai, rejoindre_groupe(2) as resultat;
select 'B : le groupe ouvert n''est plus proposé' as essai, json_array_length(groupes_visibles()) as groupes, (groupes_visibles()->0->>'ma_demande') as ma_demande;
reset role;

select set_config('essai.uid', 'cccccccc-0000-0000-0000-000000000003', false);
set role authenticated;
select 'C (promo 2) ne voit que le groupe ouvert' as essai, json_array_length(groupes_visibles()) as groupes, (groupes_visibles()->0->>'nom') as nom;
do $$ begin
  begin
    perform rejoindre_groupe(1);
    raise exception 'C a pu demander un groupe hors de son cercle';
  exception when others then
    if sqlerrm like '%pas ouvert%' then raise notice 'refusé comme attendu'; else raise; end if;
  end;
end $$;
reset role;

select set_config('essai.uid', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
select 'A voit la demande' as essai, json_array_length(demandes_groupe(1)) as demandes, (demandes_groupe(1)->0->>'prenom') as qui;
select traiter_demande_groupe(1, 'bbbbbbbb-0000-0000-0000-000000000002', true);
select 'A accepte' as essai, (select count(*)::int from conversation_membres where conversation_id = 1) as membres, json_array_length(demandes_groupe(1)) as demandes;
reset role;

-- refus puis nouvelle demande trop tôt
select set_config('essai.uid', 'cccccccc-0000-0000-0000-000000000003', false);
set role authenticated;
update profiles set promotion_id = (select promotion_id from profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001') where id = 'cccccccc-0000-0000-0000-000000000003';
select 'C (maintenant promo 3) demande' as essai, rejoindre_groupe(1) as resultat;
reset role;
select set_config('essai.uid', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
select traiter_demande_groupe(1, 'cccccccc-0000-0000-0000-000000000003', false);
reset role;
select set_config('essai.uid', 'cccccccc-0000-0000-0000-000000000003', false);
set role authenticated;
do $$ begin
  begin
    perform rejoindre_groupe(1);
    raise exception 'C a pu redemander juste après un refus';
  exception when others then
    if sqlerrm like '%moins d''une semaine%' then raise notice 'refusé comme attendu (7 jours)'; else raise; end if;
  end;
end $$;
select 'C voit le refus' as essai, g->>'ma_demande' as ma_demande from json_array_elements(groupes_visibles()) g where g->>'nom' = 'Promo 3 à Ouaga';
reset role;
