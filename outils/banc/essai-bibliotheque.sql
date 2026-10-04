-- Essai au banc : bibliothèque (migration 82).
--   npm run banc -- outils/banc/essai-bibliotheque.sql
-- Bob (membre) propose deux fiches ; il ne voit que les publiées (0) et ne peut pas modérer ; Ana
-- (déléguée) voit les 2 en attente, publie l'une, refuse l'autre avec motif (renvoie le drive_id) ;
-- Bob voit alors 1 publiée ; Bob retire sa propre proposition tant qu'elle attend, pas une publiée ;
-- Ana propose à son tour : publié d'emblée, sans relecture, tracé au journal (migration 83) ;
-- journal : 3 lignes ; sans session : refus ; aucun droit de table ; liste blanche 4.

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@essai', '{"prenom":"Ana","nom":"A","promotion":3}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@essai', '{"prenom":"Bob","nom":"B","promotion":3}');
update profiles set statut_compte = 'valide' where id in ('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002');
update profiles set role = 'delegue' where id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- Bob propose
select set_config('essai.uid', 'bbbbbbbb-0000-0000-0000-000000000002', false);
select bibliotheque_proposer('Bac C 2019 — Mathématiques', 'annale', 'Mathématiques', 'bac', 2019, 'C', 'Sujet complet', 'https://drive.google.com/file/d/abc123/view', 'abc123', 1200000);
select bibliotheque_proposer('Composition de physique 2e trimestre', 'devoir', 'Physique-Chimie', 'terminale', 2021, null, null, 'https://exemple.org/physique.pdf');
select 'Bob voit ' || json_array_length(bibliotheque_liste()) || ' fiche(s) publiée(s) (attendu 0)';
do $$ begin
  perform bibliotheque_liste('en_attente');
  raise exception 'ÉCHEC : un membre lit la file d''attente';
exception when others then
  if sqlerrm like '%ÉCHEC%' then raise; end if;
  raise notice 'ok : file d''attente refusée à un membre';
end $$;
do $$ begin
  perform bibliotheque_moderer((select id from bibliotheque limit 1), 'publie');
  raise exception 'ÉCHEC : un membre a modéré';
exception when others then
  if sqlerrm like '%ÉCHEC%' then raise; end if;
  raise notice 'ok : modération refusée à un membre';
end $$;

-- Ana modère
select set_config('essai.uid', 'aaaaaaaa-0000-0000-0000-000000000001', false);
select 'Ana voit ' || json_array_length(bibliotheque_liste('en_attente')) || ' en attente (attendu 2)';
select 'publication → drive à supprimer : ' || coalesce(bibliotheque_moderer((select id from bibliotheque where titre like 'Bac C%'), 'publie'), '(aucun)') || ' (attendu aucun)';
select 'refus → drive à supprimer : ' || coalesce(bibliotheque_moderer((select id from bibliotheque where titre like 'Composition%'), 'refuse', 'Ce n''est pas un sujet complet'), '(aucun)') || ' (attendu aucun : lien externe)';
select 'après modération : ' || json_array_length(bibliotheque_liste()) || ' publiée(s), ' || json_array_length(bibliotheque_liste('refuse')) || ' refusée(s) (attendu 1 et 1), motif = ' || (bibliotheque_liste('refuse')->0->>'motif_refus');
-- Ana propose elle-même : publié d'emblée (migration 83)
select bibliotheque_proposer('Cours de SVT — la cellule', 'cours', 'SVT', 'seconde', 2022, null, null, 'https://exemple.org/cellule.pdf');
select 'Ana propose → statut « ' || statut || ' » (attendu publie), modéré par elle-même : ' || (modere_par = propose_par) || ', en attente : ' || json_array_length(bibliotheque_liste('en_attente')) || ' (attendu 0)' from bibliotheque where titre like 'Cours de SVT%';
select 'journal : ' || count(*) || ' ligne(s) bibliotheque (attendu 3) — ' || string_agg(details->>'decision' || case when coalesce((details->>'direct')::boolean, false) then ' (direct)' else '' end, ', ' order by quand) from journal where action = 'bibliotheque';

-- Bob : voit la publiée, ne peut pas la retirer, peut retirer une nouvelle proposition à lui
select set_config('essai.uid', 'bbbbbbbb-0000-0000-0000-000000000002', false);
select 'Bob voit ' || json_array_length(bibliotheque_liste()) || ' publiée(s) (attendu 2)';
do $$ begin
  perform bibliotheque_supprimer((select id from bibliotheque where statut = 'publie' limit 1));
  raise exception 'ÉCHEC : un membre a retiré une fiche publiée';
exception when others then
  if sqlerrm like '%ÉCHEC%' then raise; end if;
  raise notice 'ok : retrait d''une publiée refusé à un membre';
end $$;
select bibliotheque_proposer('Brouillon', 'cours', 'SVT', 'premiere', 2020, null, null, 'https://exemple.org/svt.pdf');
select 'Bob retire sa proposition en attente → ' || coalesce(bibliotheque_supprimer((select id from bibliotheque where titre = 'Brouillon')), '(pas de fichier Drive)');
select 'reste ' || count(*) || ' fiche(s) (attendu 3 : les deux publiées et la refusée)' from bibliotheque;

-- sans session
select set_config('essai.uid', '', false);
do $$ begin
  perform bibliotheque_liste();
  raise exception 'ÉCHEC : lecture sans session';
exception when others then
  if sqlerrm like '%ÉCHEC%' then raise; end if;
  raise notice 'ok : lecture refusée sans session';
end $$;

-- conformité
select 'droits de table anon/authenticated : ' || count(*) || ' (attendu 0)' from information_schema.role_table_grants where table_name = 'bibliotheque' and grantee in ('anon','authenticated');
select 'liste blanche : ' || count(*) || ' (attendu 4)' from sante_fonctions_ouvertes where nom like 'bibliotheque_%';
