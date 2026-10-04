-- Essai au banc : profil minimum et réciprocité (migration 84).
--   npm run banc -- outils/banc/essai-profil-complet.sql
-- Bob (validé, profil vide) : profil_complet() faux ; publier, poser une question, demander un
-- contact, ouvrir une conversation, proposer un document → REFUSÉS ; contacts_de(Ana) → verrou.
-- Bob complète (photo, ligne, ville, pays) : tout passe, contacts_de rend les coordonnées.
-- Élève (Eli) : pas de ligne de présentation exigée. Relances : Bob validé il y a 20 jours et
-- incomplet → 1 relance (compteur 1, date posée) ; 2e appel le même jour → rien ; complet → rien.
-- Les politiques ne s'appliquent qu'au rôle authenticated : « set role authenticated » autour des gestes.

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@essai', '{"prenom":"Ana","nom":"A","promotion":3}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@essai', '{"prenom":"Bob","nom":"B","promotion":3}'),
  ('eeeeeeee-0000-0000-0000-000000000005', 'e@essai', '{"prenom":"Eli","nom":"E","promotion":3}');
update profiles set statut_compte = 'valide' where id in
  ('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002','eeeeeeee-0000-0000-0000-000000000005');
-- le déclencheur de validation pose valide_le = now() : on antidate APRÈS, dans un ordre à part
update profiles set valide_le = now() - interval '20 days' where statut_compte = 'valide';
update profiles set photo_url = 'https://x/a.jpg', statut_titre = 'Ingénieure', ville = 'Ouaga', pays = 'BF', whatsapp = '+22670000000', whatsapp_visi = 'membres'
 where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update profiles set situation = 'eleve', photo_url = 'https://x/e.jpg', ville = 'Ouaga', pays = 'BF' where id = 'eeeeeeee-0000-0000-0000-000000000005';

-- Bob, profil vide
select set_config('essai.uid', 'bbbbbbbb-0000-0000-0000-000000000002', false);
set role authenticated;
select 'Bob : profil_complet = ' || profil_complet() || ' (attendu false)';
do $$ begin
  insert into publications (auteur, texte, visibilite) values (auth.uid(), 'coucou', 'tous');
  raise exception 'ÉCHEC : publication acceptée avec un profil vide';
exception when others then
  if sqlerrm like '%ÉCHEC%' then raise; end if;
  raise notice 'ok : publication refusée (%)', left(sqlerrm, 60);
end $$;
do $$ begin
  insert into questions (auteur, titre, theme) values (auth.uid(), 'Une question ?', 'Orientation');
  raise exception 'ÉCHEC : question acceptée avec un profil vide';
exception when others then
  if sqlerrm like '%ÉCHEC%' then raise; end if;
  raise notice 'ok : question refusée';
end $$;
do $$ begin
  insert into demandes_contact (demandeur, cible, statut) values (auth.uid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'attente');
  raise exception 'ÉCHEC : demande de contact acceptée avec un profil vide';
exception when others then
  if sqlerrm like '%ÉCHEC%' then raise; end if;
  raise notice 'ok : demande de contact refusée';
end $$;
do $$ begin
  perform ouvrir_duo('aaaaaaaa-0000-0000-0000-000000000001');
  raise exception 'ÉCHEC : conversation ouverte avec un profil vide';
exception when others then
  if sqlerrm like '%ÉCHEC%' then raise; end if;
  if sqlerrm <> 'profil_incomplet' then raise exception 'ÉCHEC : message inattendu %', sqlerrm; end if;
  raise notice 'ok : conversation refusée (profil_incomplet)';
end $$;
do $$ begin
  perform bibliotheque_proposer('Sujet', 'annale', 'Maths', 'bac', 2020, 'C', null, 'https://exemple.org/x.pdf');
  raise exception 'ÉCHEC : document proposé avec un profil vide';
exception when others then
  if sqlerrm like '%ÉCHEC%' then raise; end if;
  raise notice 'ok : proposition refusée';
end $$;
select 'contacts_de(Ana) pour Bob incomplet : ' || coalesce(contacts_de('aaaaaaaa-0000-0000-0000-000000000001')->>'verrou', '(pas de verrou)') || ' (attendu profil_incomplet)';
reset role;

-- relance : Bob validé il y a 20 jours, jamais relancé → 1 ; rappel immédiat → 0
select 'relances envoyées : ' || relancer_profils_incomplets() || ' (attendu 1 : Bob ; Ana et Eli sont complets)';
select 'Bob : compteur ' || relances_profil || ', daté : ' || (relance_profil_le is not null) || ' (attendu 1, true)' from profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002';
select 'second passage le même jour : ' || relancer_profils_incomplets() || ' (attendu 0)';

-- Bob complète (par lui-même, comme l'écran : mise à jour de sa propre ligne)
set role authenticated;
update profiles set photo_url = 'https://x/b.jpg', statut_titre = 'Étudiant en droit', ville = 'Rabat', pays = 'MA' where id = auth.uid();
select 'Bob complété : profil_complet = ' || profil_complet() || ' (attendu true)';
insert into publications (auteur, texte, visibilite) values (auth.uid(), 'coucou', 'tous');
insert into demandes_contact (demandeur, cible, statut) values (auth.uid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'attente');
select 'publication + demande acceptées : ' || (select count(*) from publications where auteur = auth.uid()) || ' publication, ' || (select count(*) from demandes_contact where demandeur = auth.uid()) || ' demande (attendu 1 et 1)';
select 'conversation ouverte : ' || (ouvrir_duo('aaaaaaaa-0000-0000-0000-000000000001') is not null) || ' (attendu true)';
select 'contacts_de(Ana) pour Bob complet : whatsapp = ' || coalesce(contacts_de('aaaaaaaa-0000-0000-0000-000000000001')->>'whatsapp', '(vide)') || ' (attendu +22670000000)';
reset role;
update profiles set relance_profil_le = now() - interval '11 days' where id = 'bbbbbbbb-0000-0000-0000-000000000002';
select 'relance pour un profil devenu complet : ' || relancer_profils_incomplets() || ' (attendu 0)';

-- Eli, élève : sans ligne de présentation, c'est complet
select set_config('essai.uid', 'eeeeeeee-0000-0000-0000-000000000005', false);
set role authenticated;
select 'Eli (élève, sans ligne) : profil_complet = ' || profil_complet() || ' (attendu true)';
reset role;

-- conformité
select 'politiques qui exigent le profil complet : ' || count(*) || ' (attendu 7)' from pg_policies
 where policyname in ('publications_insertion','moments_insertion','questions_insertion','reponses_insertion','evenements_insertion','dc_insertion','messages_envoi')
   and with_check like '%profil_complet%';
select 'cron quotidien : ' || (select count(*) from cron.job where jobname = 'push-rappels-quotidiens' and command like '%relancer_profils_incomplets%') || ' (attendu 1)';
select 'droits de table authenticated sur profiles : ' || count(*) || ' (attendu 4)' from information_schema.role_table_grants where table_name = 'profiles' and grantee = 'authenticated';
