-- Migration 44 — savoir SI un membre a réellement une double authentification.
--
-- Le bouton « Retirer la double authentification » s'affichait sur la fiche de
-- TOUT LE MONDE, alors que la protection ne concerne que les délégués et les
-- admins, et seulement ceux qui l'ont activée. Un admin ne pouvait pas deviner
-- s'il allait dépanner quelqu'un ou cliquer dans le vide.
--
-- La cause est simple : l'écran n'avait aucun moyen de le savoir. La liste des
-- appareils d'authentification vit dans le schéma « auth », auquel le navigateur
-- n'a pas accès — et c'est très bien ainsi. On étend donc la fonction qui donne
-- déjà l'état de l'email, plutôt que d'en créer une seconde à surveiller.
--
-- Rejouable. Le contenu renvoyé s'agrandit, il ne change pas : l'écran actuel
-- continue de fonctionner tel quel s'il est déployé avant.

create or replace function admin_email_etat(cible uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  u record;
  nb_facteurs int;
begin
  if not est_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  select email, email_confirmed_at into u from auth.users where id = cible;
  if not found then raise exception 'Compte introuvable.'; end if;

  -- Seuls les facteurs VÉRIFIÉS comptent : un facteur resté « unverified » est
  -- une activation abandonnée en cours de route, il ne protège rien et ne
  -- bloque personne. C'est aussi ce que compte admin_retire_2fa.
  select count(*) into nb_facteurs
    from auth.mfa_factors
   where user_id = cible and status = 'verified';

  return json_build_object(
    'email',       u.email,
    'confirme_le', u.email_confirmed_at,
    'double_auth', nb_facteurs
  );
end $$;

-- Vérification :
--   select admin_email_etat('<uuid d''un membre>');
--   -- doit renvoyer email, confirme_le ET double_auth (0 si non activée)
