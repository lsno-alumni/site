-- Essai au banc : Moments (migration 64).
--   npm run banc -- outils/banc/essai-moments.sql
-- A publie un moment « promo » de 24 h et un moment « tous » ; B (autre
-- promo) ne voit que le second, le marque vu ; le rail de A compte 1 vue ;
-- un moment expiré disparaît de la lecture puis de la table à la purge.

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@essai', '{"prenom":"Ana","nom":"A","promotion":3}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@essai', '{"prenom":"Bob","nom":"B","promotion":2}');
update profiles set statut_compte = 'valide' where id in ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002');

select set_config('essai.uid', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
insert into moments (auteur, media_chemin, media_type, legende, visibilite, duree_heures) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a/moment-1.jpg', 'photo', '  Promo seulement  ', 'promo', 24),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a/moment-2.jpg', 'photo', 'Pour tous', 'tous', 168);
select 'expiration posée' as essai, legende, round(extract(epoch from (expire_le - now())) / 3600) as heures from moments order by id;
select 'rail de A' as essai, json_array_length(rail_moments()) as auteurs, json_array_length(rail_moments()->0->'moments') as moments;
reset role;

select set_config('essai.uid', 'bbbbbbbb-0000-0000-0000-000000000002', false);
set role authenticated;
select 'B voit' as essai, json_array_length(rail_moments()->0->'moments') as moments, (rail_moments()->0->'moments'->0->>'legende') as legende, moments_non_vus() as non_vus;
insert into moment_vues (moment_id, membre) values (2, 'bbbbbbbb-0000-0000-0000-000000000002');
select 'B après vue' as essai, moments_non_vus() as non_vus, (rail_moments()->0->>'tout_vu') as tout_vu;
select 'bravo de B' as essai, basculer_bravo('moment', '2') as bravos;
do $$ begin
  begin
    insert into moment_vues (moment_id, membre) values (1, 'bbbbbbbb-0000-0000-0000-000000000002');
    raise exception 'B a marqué vu un moment hors de son cercle';
  exception when insufficient_privilege or check_violation then raise notice 'vue refusée comme attendu';
  end;
end $$;
reset role;

select set_config('essai.uid', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
select 'A : vues de son moment 2' as essai, (rail_moments()->0->'moments'->1->>'vues') as vues, json_array_length(vues_moment(2)) as liste;
select 'A : vues du moment de B (rien)' as essai, json_array_length(vues_moment(2)) as liste_a, json_array_length(coalesce((select vues_moment(1)), '[]'::json)) as liste_1;
reset role;

-- expiration : le moment 1 est vieilli au-delà de sa durée
update moments set expire_le = now() - interval '1 minute' where id = 1;
select set_config('essai.uid', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
select 'A après expiration' as essai, json_array_length(rail_moments()->0->'moments') as moments;
reset role;
select 'purge' as essai, purge_moments_expires() as purges;
select 'restants' as essai, count(*)::int as n from moments;   -- instruction séparée : dans la même, le compte verrait l'état d'avant
