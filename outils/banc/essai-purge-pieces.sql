-- Essai au banc : purge des pièces jointes expirées (migration 86).
--   npm run banc -- outils/banc/essai-purge-pieces.sql
-- Reproduit l'échec du 04-05/10 : un vocal (texte vide) dont la pièce a expiré ; purge_pieces()
-- doit le marquer expiré sans violer la règle du texte, et une photo encore valable reste intacte.

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@essai', '{"prenom":"Ana","nom":"A","promotion":3}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@essai', '{"prenom":"Bob","nom":"B","promotion":3}');
update profiles set statut_compte = 'valide', photo_url = 'https://x/p.jpg', statut_titre = 'Ancien', ville = 'Ouaga', pays = 'BF'
 where id in ('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002');
select set_config('essai.uid', 'aaaaaaaa-0000-0000-0000-000000000001', false);
select ouvrir_duo('bbbbbbbb-0000-0000-0000-000000000002') as conversation;

-- un vocal sans texte, expiré hier ; une photo sans texte, encore valable 10 jours
insert into messages (conversation_id, auteur, texte, fichier_chemin, fichier_type, fichier_nom, fichier_taille, fichier_expire_le)
  values (1, 'aaaaaaaa-0000-0000-0000-000000000001', '', '1/a/vocal.webm', 'audio', 'vocal.webm', 53281, now() - interval '1 day'),
         (1, 'aaaaaaaa-0000-0000-0000-000000000001', '', '1/a/photo.jpg', 'photo', 'photo.jpg', 120000, now() + interval '10 days');
select 'avant : ' || count(*) || ' pièces en place (attendu 2)' from messages where fichier_chemin is not null and not fichier_expiree;

select 'purge_pieces() a traité ' || purge_pieces() || ' pièce(s) (attendu 1, sans erreur)';
select 'vocal : chemin ' || coalesce(fichier_chemin, '(vide)') || ', expirée = ' || fichier_expiree || ' (attendu vide, true)' from messages where fichier_nom = 'vocal.webm';
select 'photo : chemin ' || coalesce(fichier_chemin, '(vide)') || ', expirée = ' || fichier_expiree || ' (attendu 1/a/photo.jpg, false)' from messages where fichier_nom = 'photo.jpg';
select 'second passage : ' || purge_pieces() || ' (attendu 0)';

-- la règle du texte tient toujours pour un vrai message vide
do $$ begin
  insert into messages (conversation_id, auteur, texte) values (1, 'aaaaaaaa-0000-0000-0000-000000000001', '   ');
  raise exception 'ÉCHEC : message vide accepté';
exception when others then
  if sqlerrm like '%ÉCHEC%' then raise; end if;
  raise notice 'ok : message vide refusé';
end $$;
select 'messages en base : ' || count(*) || ' (attendu 2 : le vide a été refusé)' from messages;
