-- ============================================================
-- Migration 30 — correctif du socle push (suite)
--   La route /api/push lit les abonnements avec la clé service_role pour
--   pouvoir notifier N'IMPORTE QUEL membre (la RLS ne laisse chacun voir
--   que les siens) et supprimer les abonnements périmés.
--   Or « Automatically expose new tables » est DÉSACTIVÉ sur ce projet :
--   une table neuve n'a AUCUN privilège tant qu'on ne les accorde pas,
--   y compris pour service_role → « permission denied for table
--   push_abonnements » (HTTP 500 renvoyé par la route).
-- ============================================================

grant select, insert, update, delete on push_abonnements to service_role;
grant usage, select on sequence push_abonnements_id_seq to service_role;
