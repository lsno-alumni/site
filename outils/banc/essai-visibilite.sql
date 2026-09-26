-- Essai au banc : le cercle de visibilité des publications (migration 52).
--   npm run banc -- outils/banc/essai-visibilite.sql
-- Trois membres validés : A (promo 3, informatique) publie ; B (promo 4,
-- informatique) et C (promo 3, sante) lisent. Le rôle `authenticated` subit
-- la RLS ; le banc pose l'identité via essai.uid.

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@essai', '{"prenom":"Ana","nom":"A","promotion":3,"domaine":"informatique"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@essai', '{"prenom":"Bob","nom":"B","promotion":4,"domaine":"informatique"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@essai', '{"prenom":"Cléo","nom":"C","promotion":3,"domaine":"sante"}');
update profiles set statut_compte = 'valide' where id in
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000003');

-- A publie une fois par cercle
select set_config('essai.uid', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
insert into publications (auteur, texte, visibilite) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'pour tout le réseau', 'tous'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'pour ma promo', 'promo'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'pour mon domaine', 'domaine');
select 'A (auteur) voit' as qui, count(*)::int as n from publications;
reset role;

-- B : même domaine, autre promo → tous + domaine = 2
select set_config('essai.uid', 'bbbbbbbb-0000-0000-0000-000000000002', false);
set role authenticated;
select 'B (promo 4, informatique) voit' as qui, string_agg(texte, ' | ' order by id) as quoi from publications;
-- B ne peut pas applaudir la publication réservée à la promo
select 'B bravo sur promo → doit échouer' as essai;
do $$ begin
  insert into reactions (cible_type, cible_id, membre)
  select 'publication', id::text, 'bbbbbbbb-0000-0000-0000-000000000002' from publications where false;
  begin
    insert into reactions (cible_type, cible_id, membre) values ('publication', '2', 'bbbbbbbb-0000-0000-0000-000000000002');
    raise exception 'le bravo de B sur une publication de promo est passé';
  exception when insufficient_privilege or check_violation then
    raise notice 'refusé comme attendu';
  end;
end $$;
reset role;

-- C : même promo, autre domaine → tous + promo = 2
select set_config('essai.uid', 'cccccccc-0000-0000-0000-000000000003', false);
set role authenticated;
select 'C (promo 3, sante) voit' as qui, string_agg(texte, ' | ' order by id) as quoi from publications;
select 'fil_publications pour C' as rpc, json_array_length(fil_publications(10, null)) as n;
reset role;
