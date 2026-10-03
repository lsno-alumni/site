-- Essai au banc : connexion par lien email (migration 79).
--   npm run banc -- outils/banc/essai-connexion-lien.sql
-- noter_connexion_lien() écrit une ligne de journal pour le compte connecté, une seule par minute,
-- rien sans session ; la fonction est bien dans la liste blanche du contrôle de santé.

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@essai', '{"prenom":"Ana","nom":"A","promotion":3}');
update profiles set statut_compte = 'valide' where id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- sans session : rien
select noter_connexion_lien();
select 'sans session : ' || count(*) || ' ligne(s) (attendu 0)' from journal where action = 'connexion_lien';

-- avec la session de Ana : une ligne, puis une seule malgré un second appel
select set_config('essai.uid', 'aaaaaaaa-0000-0000-0000-000000000001', false);
select noter_connexion_lien();
select noter_connexion_lien();
select 'avec session : ' || count(*) || ' ligne(s) (attendu 1), acteur = ' || max(acteur_nom) || ', cible = ' || max(cible_nom) from journal where action = 'connexion_lien';
select 'liste blanche : ' || count(*) || ' (attendu 1)' from sante_fonctions_ouvertes where nom = 'noter_connexion_lien';
