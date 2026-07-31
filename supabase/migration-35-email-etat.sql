-- Migration 35 — la fiche « Gérer un membre » doit montrer si l'email de
-- connexion est confirmé.
--
-- admin_email_de() ne renvoyait que l'adresse : l'interface ne pouvait donc
-- afficher l'état de confirmation qu'après l'avoir elle-même provoqué, jamais à
-- l'ouverture de la fiche. Cette fonction renvoie les deux d'un coup, lus dans
-- auth.users (inaccessible depuis le navigateur, d'où le security definer).
--
-- admin_email_de() est CONSERVÉE : la migration peut être exécutée avant que le
-- déploiement du site ne soit terminé, et l'ancienne interface l'appelle encore.
--
-- Rejouable.

create or replace function admin_email_etat(cible uuid) returns json
language plpgsql security definer set search_path = public as $$
declare u record;
begin
  if not est_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  select email, email_confirmed_at into u from auth.users where id = cible;
  if not found then raise exception 'Compte introuvable.'; end if;
  return json_build_object('email', u.email, 'confirme_le', u.email_confirmed_at);
end $$;

-- Pas de grant explicite : comme les vingt autres fonctions admin du projet, le
-- contrôle d'accès est fait DANS la fonction (est_admin), et l'exécution reste
-- ouverte par défaut. Ajouter un revoke ici créerait une exception à surveiller.
