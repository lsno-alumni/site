-- Essai au banc : Événements (migration 66).
--   npm run banc -- outils/banc/essai-evenements.sql
-- A (délégué) crée un événement « promo » demain → marque Amicale ; B (même
-- promo) le voit, répond oui ; C (autre promo) ne le voit pas ; la liste
-- « à venir » le classe ; le rappel de la veille part une seule fois ; une
-- photo n'est acceptée que d'un participant ; changement de date → rappel
-- réarmé ; annulation ; l'événement passé bascule dans « passés ».

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@essai', '{"prenom":"Ana","nom":"A","promotion":3}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@essai', '{"prenom":"Bob","nom":"B","promotion":3}'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@essai', '{"prenom":"Cléo","nom":"C","promotion":2}');
update profiles set statut_compte = 'valide' where id in
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000003');
update profiles set role = 'delegue' where id = 'aaaaaaaa-0000-0000-0000-000000000001';

select set_config('essai.uid', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
insert into evenements (organisateur, titre, description, debut, lieu_type, ville, pays, visibilite) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '  Dîner de la promo 3  ', 'On se retrouve.', now() + interval '20 hours', 'sur_place', 'Ouagadougou', 'BF', 'promo');
select 'création' as essai, titre, officiel, (liste_evenements('a_venir')->0->>'nb_oui') as nb_oui from evenements;
reset role;

select set_config('essai.uid', 'bbbbbbbb-0000-0000-0000-000000000002', false);
set role authenticated;
select 'B voit' as essai, json_array_length(liste_evenements('a_venir')) as a_venir;
insert into evenement_reponses (evenement_id, membre, reponse) values (1, 'bbbbbbbb-0000-0000-0000-000000000002', 'oui');
select 'B a répondu' as essai, (lire_evenement(1)->>'ma_reponse') as ma_reponse, (lire_evenement(1)->>'nb_oui') as nb_oui, json_array_length(lire_evenement(1)->'participants') as participants;
insert into evenement_photos (evenement_id, auteur, chemin) values (1, 'bbbbbbbb-0000-0000-0000-000000000002', 'b/evt-1-1.jpg');
select 'photo de B' as essai, (lire_evenement(1)->>'nb_photos') as nb_photos;
reset role;

select set_config('essai.uid', 'cccccccc-0000-0000-0000-000000000003', false);
set role authenticated;
select 'C (autre promo) ne voit rien' as essai, json_array_length(liste_evenements('a_venir')) as a_venir;
do $$ begin
  begin
    insert into evenement_photos (evenement_id, auteur, chemin) values (1, 'cccccccc-0000-0000-0000-000000000003', 'c/evt-1-1.jpg');
    raise exception 'C a ajouté une photo sans participer';
  exception when insufficient_privilege or check_violation then raise notice 'photo refusée comme attendu';
  end;
end $$;
reset role;

-- rappel de la veille : part une fois
select 'rappel' as essai, rappel_evenements() as envoyes;
select 'rappel à nouveau' as essai, rappel_evenements() as envoyes;

-- A déplace la date → le rappel se réarme
select set_config('essai.uid', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
update evenements set debut = now() + interval '26 hours' where id = 1;
select 'après changement de date' as essai, rappel_envoye from evenements where id = 1;
update evenements set annule = true where id = 1;
select 'annulé' as essai, annule from evenements where id = 1;
reset role;

-- un événement passé
select set_config('essai.uid', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
insert into evenements (organisateur, titre, debut, visibilite) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Afterwork de septembre', now() - interval '2 days', 'tous');
select 'listes' as essai, json_array_length(liste_evenements('a_venir')) as a_venir, json_array_length(liste_evenements('passes')) as passes;
reset role;
