-- Essai au banc : questions aux anciens (migrations 59 à 61).
--   npm run banc -- outils/banc/essai-questions.sql
-- A pose une question anonyme ; B (membre ordinaire) la voit « Anonyme » ;
-- B répond ; A retient la réponse ; la fermeture automatique à 30 jours
-- bloque une nouvelle réponse ; rouvrir la libère.

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@essai', '{"prenom":"Ana","nom":"A","promotion":3}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@essai', '{"prenom":"Bob","nom":"B","promotion":2}');
update profiles set statut_compte = 'valide' where id in ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002');

select set_config('essai.uid', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
insert into questions (auteur, titre, details, theme, anonyme) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Prépa ou université ?', 'Je suis en terminale.', 'Orientation post-bac', true);
select 'A voit son nom' as essai, lire_question(1)->'auteur'->>'prenom' as prenom;
reset role;

select set_config('essai.uid', 'bbbbbbbb-0000-0000-0000-000000000002', false);
set role authenticated;
select 'B voit' as essai, lire_question(1)->'auteur'->>'prenom' as prenom, (liste_questions('sans_reponse')->0->>'titre') as sans_reponse;
insert into reponses (question_id, auteur, texte) values (1, 'bbbbbbbb-0000-0000-0000-000000000002', 'La prépa, sans hésiter.');
select 'recherche « prépa »' as essai, json_array_length(liste_questions('toutes', null, 20, null, 'prépa')) as n;
select 'recherche « zzz »' as essai, json_array_length(liste_questions('toutes', null, 20, null, 'zzz')) as n;
reset role;

-- A retient la réponse → résolue
select set_config('essai.uid', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
update questions set meilleure_reponse = 1, resolue = true where id = 1;
select 'résolue' as essai, resolue, fermee from questions where id = 1;
reset role;

-- 31 jours plus tard : fermeture automatique (le déclencheur remet maj_le à
-- maintenant à chaque mise à jour : on le suspend le temps de vieillir la ligne)
alter table questions disable trigger questions_avant_update;
update questions set maj_le = now() - interval '31 days' where id = 1;
alter table questions enable trigger questions_avant_update;
update reponses set cree_le = now() - interval '31 days' where id = 1;
select 'fermeture' as essai, fermer_questions() as fermees;
select set_config('essai.uid', 'bbbbbbbb-0000-0000-0000-000000000002', false);
set role authenticated;
do $$ begin
  begin
    insert into reponses (question_id, auteur, texte) values (1, 'bbbbbbbb-0000-0000-0000-000000000002', 'Trop tard ?');
    raise exception 'une réponse est passée sur une question fermée';
  exception when insufficient_privilege or check_violation then
    raise notice 'refusée comme attendu';
  end;
end $$;
select 'B après fermeture : réponses' as essai, count(*)::int as n from reponses where question_id = 1;
reset role;

-- A rouvre → la question se libère
select set_config('essai.uid', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
update questions set resolue = false, meilleure_reponse = null where id = 1;
select 'rouverte' as essai, resolue, fermee from questions where id = 1;
reset role;
