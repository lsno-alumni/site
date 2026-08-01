-- ============================================================================
-- CONTRÔLE DE SANTÉ — raccourci de lecture.
--
-- La logique vit dans la VUE « sante_systeme », créée par
-- supabase/migration-40-controle-sante.sql : c'est la source de vérité unique du
-- modèle attendu (droits par rôle et par table, RLS, fonctions verrouillées ou
-- ouvertes, tâches planifiées, déclencheurs, secrets du Vault, colonnes clés).
-- Un seul endroit à mettre à jour quand le modèle évolue.
--
-- Ne modifie RIEN : que des lectures de catalogues.
-- Règle de lecture : chercher « PROBLÈME ». Les lignes en défaut sont en tête ;
-- si la première dit « ok », tout est en ordre.
-- ============================================================================

select * from sante_systeme;

-- Variante : ne montrer que ce qui cloche
--   select * from sante_systeme where verdict like 'PROBL%';
--
-- Le même contrôle, tel que la tâche mensuelle le voit (et qui prévient les
-- admins par email + notification s'il trouve quelque chose) :
--   select controle_sante();     -- « ok — aucun problème » quand tout va bien
