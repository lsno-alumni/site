-- ============================================================
-- Migration 23 — ajoute la valeur « eleve » au type situation.
--
-- ⚠ À EXÉCUTER SEULE, AVANT la migration 24.
--   PostgreSQL interdit d'utiliser une valeur d'enum dans la même
--   transaction que son ajout — donc ce fichier ne contient QUE
--   l'ajout. La logique qui s'en sert est dans la migration 24.
-- ============================================================

alter type situation_t add value if not exists 'eleve';
