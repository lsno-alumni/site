-- Migration 47 — verrouiller maj_double_auth_active() (oubli de la migration 46).
--
-- Le contrôle de santé mensuel a fait exactement son travail : une nouvelle
-- fonction security definer, appelée ici uniquement PAR un déclencheur sur
-- auth.mfa_factors, restait exécutable directement par n'importe quel membre
-- connecté — comme toutes les fonctions de déclencheur du projet (voir
-- journal_profil()/journal_suppression(), migration 36), elle doit avoir ses
-- droits retirés explicitement : l'exposition automatique par défaut de
-- PostgreSQL est PRÉCISÉMENT ce que ce projet désactive partout ailleurs.
--
-- Sans conséquence pratique ici — l'appeler hors d'un déclencheur échoue
-- immédiatement (elle lit NEW/OLD, qui n'existent que dans ce contexte) — mais
-- toute fonction security definer non déclarée est par principe suspecte, et
-- le contrôle de santé la signale à raison.
--
-- Rejouable.

revoke all on function maj_double_auth_active() from public, anon, authenticated;

-- Vérification :  select controle_sante();   -- doit redevenir « ok »
