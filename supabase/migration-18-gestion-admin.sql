-- ============================================================
-- Migration 18 — gestion des membres par les admins (UI Validation)
--   Les policies existantes couvrent déjà : modifier prénom/nom/
--   promotion, suspendre/réactiver, nommer co-admin (RLS + trigger).
--   Cette migration ajoute ce qui touche au COMPTE DE CONNEXION
--   (auth.users), inaccessible autrement :
--     ① lire l'email de connexion d'un membre
--     ② confirmer son email à la main (email jamais reçu)
--     ③ définir un mot de passe temporaire (email + mdp oubliés)
--     ④ supprimer un compte (avec ses données, comme l'auto-suppression)
--   Toutes vérifient que l'appelant est un ADMIN VALIDÉ.
-- ============================================================

create extension if not exists pgcrypto;

-- garde commune
create or replace function est_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role = 'admin' and statut_compte = 'valide'
     from profiles where id = auth.uid()), false);
$$;

-- ① email de connexion (affichage + renvois d'emails côté app)
create or replace function admin_email_de(cible uuid) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not est_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  return (select email from auth.users where id = cible);
end $$;

-- ② confirmation manuelle de l'email
create or replace function admin_confirme_email(cible uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not est_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  update auth.users
     set email_confirmed_at = coalesce(email_confirmed_at, now())
   where id = cible;
end $$;

-- ③ mot de passe temporaire (à communiquer au membre, qui le changera)
create or replace function admin_mdp_temporaire(cible uuid, nouveau text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not est_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  if char_length(nouveau) < 8 then
    raise exception 'Mot de passe trop court (8 caractères minimum).';
  end if;
  update auth.users
     set encrypted_password = crypt(nouveau, gen_salt('bf'))
   where id = cible;
end $$;

-- ④ suppression d'un compte par un admin
--    Garde-fous : pas soi-même (passer par Mon profil), pas un autre admin
--    (le rétrograder d'abord — évite la suppression mutuelle).
create or replace function admin_supprime_compte(cible uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not est_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  if cible = auth.uid() then
    raise exception 'Pour ton propre compte, passe par Mon profil.';
  end if;
  if (select role from profiles where id = cible) = 'admin' then
    raise exception 'On ne supprime pas un administrateur (le rétrograder d''abord).';
  end if;
  -- profil + parcours + demandes + offres partent en cascade
  delete from auth.users where id = cible;
end $$;

-- la photo du membre supprimé se retire côté app (API Storage),
-- comme pour l'auto-suppression — le DELETE SQL sur storage est interdit.

-- Vérification (facultatif) : select est_admin();  -- true pour toi
