-- Essai au banc : carrousel des promotions (migration 80).
--   npm run banc -- outils/banc/essai-carrousel.sql
-- Les 4 photos existantes sont rattachées (promos 1, 2, 3, 5) ; la déléguée de la promo 3 remplace
-- et retitre la sienne, ajoute la seconde, ne peut pas toucher à la promo 2 ; un membre ne peut rien ;
-- un admin peut tout ; le retrait efface la ligne ; chaque geste est au journal ; la liste publique
-- (sans session) répond ; aucun droit de table pour anon/authenticated ; fonctions en liste blanche.

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@essai', '{"prenom":"Ana","nom":"A","promotion":3}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@essai', '{"prenom":"Bob","nom":"B","promotion":3}'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@essai', '{"prenom":"Cléo","nom":"C","promotion":2}');
update profiles set statut_compte = 'valide' where id in ('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002','cccccccc-0000-0000-0000-000000000003');
update profiles set role = 'delegue' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update profiles set role = 'admin'   where id = 'cccccccc-0000-0000-0000-000000000003';

select 'photos de départ : ' || json_array_length(carrousel_liste()->'photos') || ' (attendu 4)';

-- Ana, déléguée de la promo 3
select set_config('essai.uid', 'aaaaaaaa-0000-0000-0000-000000000001', false);
select carrousel_enregistrer((select id from promotions where numero = 3), 1, 'carrousel/promo-' || (select id from promotions where numero = 3) || '/1.jpg', 'Sortie à Bobo, 2021');
select carrousel_enregistrer((select id from promotions where numero = 3), 2, 'carrousel/promo-' || (select id from promotions where numero = 3) || '/2.jpg', 'Remise des diplômes');
select 'promo 3 : ' || count(*) || ' photo(s) (attendu 2), titre 1 = ' || min(titre) filter (where position = 1) from carrousel_photos where promotion_id = (select id from promotions where numero = 3);
do $$ begin
  perform carrousel_enregistrer((select id from promotions where numero = 2), 2, '/img/x.jpg', 'Pirate');
  raise exception 'ÉCHEC : Ana a pu écrire sur la promo 2';
exception when others then
  if sqlerrm like '%ÉCHEC%' then raise; end if;
  raise notice 'ok : refus pour une autre promo (%)', sqlerrm;
end $$;
do $$ begin
  perform carrousel_enregistrer((select id from promotions where numero = 3), 1, 'carrousel/promo-999/1.jpg', 'Chemin trompeur');
  raise exception 'ÉCHEC : chemin d''une autre promo accepté';
exception when others then
  if sqlerrm like '%ÉCHEC%' then raise; end if;
  raise notice 'ok : chemin hors dossier refusé';
end $$;

-- Bob, simple membre
select set_config('essai.uid', 'bbbbbbbb-0000-0000-0000-000000000002', false);
do $$ begin
  perform carrousel_enregistrer((select id from promotions where numero = 3), 1, '/img/x.jpg', 'Membre');
  raise exception 'ÉCHEC : un membre a pu écrire';
exception when others then
  if sqlerrm like '%ÉCHEC%' then raise; end if;
  raise notice 'ok : refus pour un membre';
end $$;

-- Cléo, admin : retitre la promo 5 puis retire la photo 2 de la promo 3
select set_config('essai.uid', 'cccccccc-0000-0000-0000-000000000003', false);
select carrousel_enregistrer((select id from promotions where numero = 5), 1, '/img/lsno_groupe.jpg', 'Promo 5 avec le proviseur du lycée');
select 'retrait → chemin renvoyé : ' || coalesce(carrousel_retirer((select id from promotions where numero = 3), 2), '(aucun)') || ' (attendu carrousel/promo-…/2.jpg)';
select 'après admin : promo 3 = ' || (select count(*) from carrousel_photos where promotion_id = (select id from promotions where numero = 3)) || ' photo (attendu 1), titre promo 5 = ' || (select titre from carrousel_photos where promotion_id = (select id from promotions where numero = 5));

-- journal : 4 écritures (2 Ana + 2 Cléo)
select 'journal : ' || count(*) || ' ligne(s) carrousel (attendu 4), dont retrait : ' || count(*) filter (where details->>'action' = 'retrait') from journal where action = 'carrousel';

-- sans session : la liste publique répond, dans l'ordre des promotions
select set_config('essai.uid', '', false);
select 'liste publique : ' || json_array_length(carrousel_liste()->'photos') || ' photos (attendu 4), première = promo ' || (carrousel_liste()->'photos'->0->>'numero');

-- conformité
select 'droits de table anon/authenticated sur carrousel_photos : ' || count(*) || ' (attendu 0)' from information_schema.role_table_grants where table_name = 'carrousel_photos' and grantee in ('anon','authenticated');
select 'liste blanche : ' || count(*) || ' (attendu 3)' from sante_fonctions_ouvertes where nom in ('carrousel_liste','carrousel_enregistrer','carrousel_retirer');
