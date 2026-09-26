-- Essai au banc : les Messages (migration 53).
--   npm run banc -- outils/banc/essai-messages.sql
-- A écrit à B (duo retrouvé au 2e appel), B a 2 non lus puis 0 après lecture,
-- C ne voit rien ; A crée un groupe avec B et C ; B le quitte.

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@essai', '{"prenom":"Ana","nom":"A","promotion":3}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@essai', '{"prenom":"Bob","nom":"B","promotion":4}'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@essai', '{"prenom":"Cléo","nom":"C","promotion":3}');
update profiles set statut_compte = 'valide' where id in
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000003');

-- A ouvre le duo avec B, deux fois : même conversation
select set_config('essai.uid', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
select 'duo ouvert deux fois → même id ?' as essai,
       ouvrir_duo('bbbbbbbb-0000-0000-0000-000000000002') = ouvrir_duo('bbbbbbbb-0000-0000-0000-000000000002') as meme;
insert into messages (conversation_id, auteur, texte)
  select ouvrir_duo('bbbbbbbb-0000-0000-0000-000000000002'), 'aaaaaaaa-0000-0000-0000-000000000001', '  Salut Bob  ';
insert into messages (conversation_id, auteur, texte)
  select ouvrir_duo('bbbbbbbb-0000-0000-0000-000000000002'), 'aaaaaaaa-0000-0000-0000-000000000001', 'Tu es là ?';
select 'A : non lus' as qui, messages_non_lus() as n;
reset role;

-- B lit : 2 non lus, l''aperçu, puis 0 après marquer_lu
select set_config('essai.uid', 'bbbbbbbb-0000-0000-0000-000000000002', false);
set role authenticated;
select 'B : non lus avant' as qui, messages_non_lus() as n;
select 'B : liste' as quoi, (mes_conversations()->0->>'non_lus') as non_lus, (mes_conversations()->0->'dernier'->>'texte') as dernier,
       (mes_conversations()->0->'membres'->0->>'prenom') as avec;
select marquer_lu((mes_conversations()->0->>'id')::bigint);
select 'B : non lus après lecture' as qui, messages_non_lus() as n;
select 'texte nettoyé ?' as essai, texte from messages order by id limit 1;
reset role;

-- C ne voit rien de tout ça
select set_config('essai.uid', 'cccccccc-0000-0000-0000-000000000003', false);
set role authenticated;
select 'C : conversations visibles' as qui, json_array_length(mes_conversations()) as n, (select count(*) from messages)::int as messages_visibles;
reset role;

-- A crée un groupe avec B et C ; C le voit ; B le quitte
select set_config('essai.uid', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
select 'groupe créé' as essai, creer_groupe('Promo 3 & amis', array['bbbbbbbb-0000-0000-0000-000000000002'::uuid, 'cccccccc-0000-0000-0000-000000000003'::uuid]) > 0 as ok;
insert into messages (conversation_id, auteur, texte)
  select id, 'aaaaaaaa-0000-0000-0000-000000000001', 'Bienvenue dans le groupe' from conversations where type = 'groupe';
reset role;
select set_config('essai.uid', 'cccccccc-0000-0000-0000-000000000003', false);
set role authenticated;
select 'C : voit le groupe' as qui, (mes_conversations()->0->>'nom') as nom, (mes_conversations()->0->>'nb_membres') as membres, (mes_conversations()->0->>'non_lus') as non_lus;
reset role;
select set_config('essai.uid', 'bbbbbbbb-0000-0000-0000-000000000002', false);
set role authenticated;
delete from conversation_membres where membre = 'bbbbbbbb-0000-0000-0000-000000000002' and conversation_id in (select id from conversations where type = 'groupe');
select 'B après avoir quitté : conversations' as qui, json_array_length(mes_conversations()) as n;
reset role;
select 'membres restants du groupe' as quoi, count(*)::int as n from conversation_membres m join conversations c on c.id = m.conversation_id where c.type = 'groupe';

-- purge : un vieux message disparaît, la conversation reste
update messages set cree_le = now() - interval '31 days' where texte = 'Tu es là ?';
select 'purge' as quoi, purge_messages() as supprimes, (select count(*)::int from conversations) as conversations_restantes;
