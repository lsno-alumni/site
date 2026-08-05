-- Migration 46 — fermer un vrai contournement de la double authentification.
--
-- SIGNALÉ PAR L'UTILISATEUR (03/08) : à l'écran qui demande le code, APRÈS le
-- mot de passe mais AVANT d'avoir saisi le code, le bouton « retour » du
-- navigateur ramène sur l'accueil connecté — sans jamais avoir donné le code.
--
-- Cause exacte : signInWithPassword() crée TOUJOURS une session valide (niveau
-- « aal1 »), même quand un second facteur va être demandé — c'est ainsi que
-- fonctionne Supabase, la vérification du code se fait SUR cette session, pas
-- avant elle. L'écran du code n'est qu'un état d'affichage LOCAL à la page de
-- connexion (aucun changement d'adresse) ; rien, nulle part dans le reste du
-- site, ne revérifiait qu'un compte protégé avait réellement franchi cette
-- étape. Le middleware ne demandait qu'« existe-t-il une session valide ? »,
-- et une session aal1 EST valide. « Retour » quitte simplement la page de
-- connexion vers la page précédente, qui voit une session valide et affiche
-- l'accueil membre — code jamais demandé.
--
-- ⚠ Ceci invalide la décision du 02/08 d'écarter l'exigence aal2 « jugée assez
-- sécurisée » : cette décision supposait que le seul angle mort restant était
-- une attaque directe de l'API avec un mot de passe volé. Ce contournement-ci
-- ne demande ni mot de passe volé ni outil : un bouton du navigateur suffit.
--
-- Ce qui manquait pour trancher « ce compte a-t-il vraiment fini sa double
-- authentification ? » sans appel réseau à chaque navigation (le jeton lui-
-- même le dit déjà gratuitement via son champ « aal ») : savoir si le compte a
-- seulement un appareil d'authentification vérifié. Cette colonne le dit, et
-- un déclencheur la tient à jour automatiquement, quel que soit le chemin par
-- lequel `auth.mfa_factors` change (activation, désactivation par soi-même,
-- retrait par un admin) — aucun code applicatif à maintenir en plus.
--
-- Rejouable.

alter table profiles add column if not exists double_auth_active boolean not null default false;

-- ---------- tenue à jour automatique ----------
create or replace function maj_double_auth_active() returns trigger
language plpgsql security definer set search_path = public, auth as $fn$
declare v_id uuid := coalesce(new.user_id, old.user_id);
begin
  update profiles set double_auth_active = exists (
    select 1 from auth.mfa_factors where user_id = v_id and status = 'verified'
  ) where id = v_id;
  return coalesce(new, old);
end $fn$;

drop trigger if exists mfa_factors_maj_profil on auth.mfa_factors;
create trigger mfa_factors_maj_profil
  after insert or update or delete on auth.mfa_factors
  for each row execute function maj_double_auth_active();

-- comptes déjà protégés aujourd'hui : sans ce rattrapage, leur colonne
-- resterait « false » jusqu'au prochain changement d'appareil — soit
-- exactement la faille qu'on ferme, pour eux spécifiquement
update profiles p set double_auth_active = exists (
  select 1 from auth.mfa_factors m where m.user_id = p.id and m.status = 'verified'
);

grant select (double_auth_active) on profiles to authenticated;

-- ---------- le middleware doit pouvoir lire ceci sans appel réseau séparé ----------
-- (rien à faire ici : le champ « aal » du jeton est déjà fourni gratuitement
-- par getClaims(), voir src/middleware.js)

-- Vérification :
--   select id, prenom, role, double_auth_active from profiles
--    where role in ('delegue', 'admin') order by prenom;
--   -- double_auth_active doit valoir true pour ceux qui ont réellement activé
--   -- la double authentification aujourd'hui, false pour les autres
