-- Essai au banc : réactions et mentions sur les moments (migration 65).
--   npm run banc -- outils/banc/essai-moments-suite.sql
-- A publie un moment qui mentionne B ; B réagit ❤️ puis change pour 🔥 ;
-- A voit le compte par emoji, B ne voit que la sienne ; A ne peut pas
-- réagir au nom de B.

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@essai', '{"prenom":"Ana","nom":"A","promotion":3}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@essai', '{"prenom":"Bob","nom":"B","promotion":3}'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@essai', '{"prenom":"Cléo","nom":"C","promotion":3}');
update profiles set statut_compte = 'valide' where id in
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000003');

select set_config('essai.uid', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
insert into moments (auteur, media_chemin, media_type, legende, mentions) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a/moment-1.jpg', 'photo', 'Avec @Bob B au labo', array['bbbbbbbb-0000-0000-0000-000000000002']::uuid[]);
select 'mention renvoyée par le rail' as essai, (rail_moments()->0->'moments'->0->'mentions'->0->>'prenom') as prenom;
reset role;

select set_config('essai.uid', 'bbbbbbbb-0000-0000-0000-000000000002', false);
set role authenticated;
insert into moment_reactions (moment_id, membre, emoji) values (1, 'bbbbbbbb-0000-0000-0000-000000000002', '❤️');
update moment_reactions set emoji = '🔥' where moment_id = 1 and membre = 'bbbbbbbb-0000-0000-0000-000000000002';
select 'B : sa réaction' as essai, (rail_moments()->0->'moments'->0->>'ma_reaction') as ma_reaction, (rail_moments()->0->'moments'->0->'reactions')::text as reactions;
reset role;

select set_config('essai.uid', 'cccccccc-0000-0000-0000-000000000003', false);
set role authenticated;
insert into moment_reactions (moment_id, membre, emoji) values (1, 'cccccccc-0000-0000-0000-000000000003', '🔥');
select 'C ne voit que la sienne' as essai, (rail_moments()->0->'moments'->0->'reactions')::text as reactions;
reset role;

select set_config('essai.uid', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
select 'A voit les comptes' as essai, (rail_moments()->0->'moments'->0->'reactions')::text as reactions;
do $$ begin
  begin
    insert into moment_reactions (moment_id, membre, emoji) values (1, 'bbbbbbbb-0000-0000-0000-000000000002', '😂');
    raise exception 'A a réagi au nom de B';
  exception when insufficient_privilege or check_violation or unique_violation then raise notice 'refusé comme attendu';
  end;
end $$;
reset role;
