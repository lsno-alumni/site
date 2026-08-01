-- Migration 38 — URGENCE : rétablir les droits de lecture/écriture du rôle
-- « authenticated » sur les tables de l'application.
--
-- Symptôme observé le 01/08 : « Mon profil » ne s'affichait plus (erreur
-- JavaScript, la page ne rendait rien), la recherche de membres dans Validation
-- ne renvoyait plus rien, et le site redemandait la connexion à chaque visite.
-- Un seul défaut expliquait les trois : PostgREST répondait
--
--     403 {"code":"42501","message":"permission denied for table profiles",
--          "hint":"GRANT SELECT ON public.profiles TO authenticated;"}
--
-- Autrement dit le rôle « authenticated » avait perdu ses privilèges de table.
-- Les pages qui semblaient marcher (annuaire, validation) rendaient en fait des
-- listes VIDES, et utilisateurCourant() renvoyant null, l'app concluait
-- « personne n'est connecté » et renvoyait vers /connexion.
--
-- ⚠ RAPPEL DU MODÈLE SUPABASE, pour ne plus se faire surprendre : la sécurité
-- repose sur DEUX étages indépendants. Les privilèges Postgres (grant/revoke)
-- disent quelles TABLES un rôle peut toucher ; la RLS dit quelles LIGNES. Perdre
-- le premier étage ferme tout, même si les politiques RLS sont intactes — et
-- l'erreur ne ressemble pas à un problème de droits vue du navigateur : elle
-- ressemble à une déconnexion.
--
-- Les droits sont rétablis ici EXPLICITEMENT et table par table, d'après ce que
-- l'application fait réellement, plutôt qu'avec un « grant all » global :
-- l'écriture reste refusée là où elle doit l'être.
--
--   • anon (visiteur non connecté) : AUCUN privilège de table. La vitrine
--     publique ne passe que par des fonctions (stats_publiques, apercu_profil,
--     apercu_offre) et l'inscription ne lit aucune table.
--   • journal : lecture SEULE, jamais d'écriture — c'est ce qui garantit
--     l'« ajout seul » (migration 36).
--
-- Rejouable.

-- ---------- profils et parcours ----------
-- le membre modifie le sien, le délégué change un statut : la RLS tranche
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.parcours to authenticated;

-- ---------- promotions ----------
grant select on public.promotions to authenticated;

-- ---------- offres et pièces jointes ----------
grant select, insert, update, delete on public.offres to authenticated;
grant select, insert, delete on public.offre_fichiers to authenticated;

-- ---------- mises en relation ----------
grant select, insert, update on public.demandes_contact to authenticated;

-- ---------- notifications ----------
grant select, insert, update, delete on public.push_abonnements to authenticated;

-- ---------- annonces (l'écran admin lit l'état d'envoi ; l'envoi passe par une
--            fonction security definer, donc aucun insert direct n'est requis) --
grant select on public.annonces to authenticated;
grant select on public.annonce_envois to authenticated;

-- ---------- réglages (l'interrupteur des emails d'inscription) ----------
grant select, update on public.reglages to authenticated;

-- ---------- journal : lecture seule, l'ajout seul en dépend ----------
grant select on public.journal to authenticated;
revoke insert, update, delete on public.journal from authenticated;

-- ---------- séquences ----------
-- Sans ceci, tout INSERT sur une table à identifiant automatique échoue avec
-- « permission denied for sequence » — un symptôme différent, même cause.
grant usage, select on all sequences in schema public to authenticated;

-- Note : on ne TOUCHE PAS aux droits de « anon » ici. Il n'en a besoin d'aucun
-- (la vitrine publique et les aperçus de partage passent par des fonctions), mais
-- une restauration d'urgence ne se mélange pas avec un durcissement : si un
-- privilège d'anon devait être retiré, ce sera dans une migration séparée, testée.

-- Vérification (à lancer après) : doit lister une ligne par droit accordé
--   select table_name, privilege_type
--     from information_schema.role_table_grants
--    where grantee = 'authenticated' and table_schema = 'public'
--    order by table_name, privilege_type;
