-- ============================================================
-- Migration 79 — connexion par lien email : chaque connexion est notée
--   La page de connexion propose désormais « Recevoir un lien de connexion »
--   (Supabase Auth, modèle « Magic link »). C'est une seconde porte d'entrée :
--   on la surveille. La page d'atterrissage du lien appelle
--   noter_connexion_lien() une fois la session ouverte : une ligne dans le
--   journal des actions (action « connexion_lien », l'acteur est sa propre
--   cible), lisible dans Validation → Journal, et comptée par le contrôle de
--   santé comme toute autre action.
--   Rejouable. Pas de DDL sur une table : aucun GRANT de table à rétablir.
-- ============================================================
create or replace function noter_connexion_lien() returns void
language plpgsql security definer set search_path = public as $$
declare v_moi uuid := auth.uid(); v_nom text;
begin
  if v_moi is null then return; end if;
  select prenom || ' ' || nom into v_nom from profiles where id = v_moi;
  -- au plus une ligne par minute et par compte (un lien cliqué deux fois ne compte qu'une fois)
  if exists (select 1 from journal where action = 'connexion_lien' and acteur = v_moi and quand > now() - interval '1 minute') then return; end if;
  insert into journal (acteur, acteur_nom, action, cible, cible_nom, details)
  values (v_moi, coalesce(v_nom, '(membre)'), 'connexion_lien', v_moi, v_nom, '{}'::jsonb);
end $$;
revoke all on function noter_connexion_lien() from public, anon;
grant execute on function noter_connexion_lien() to authenticated;

insert into sante_fonctions_ouvertes (nom, raison) values
  ('noter_connexion_lien', 'connexion par lien email : la page d''atterrissage note la connexion dans le journal')
on conflict (nom) do nothing;

-- Vérification :  select proname from pg_proc where proname = 'noter_connexion_lien';   -- 1 ligne
