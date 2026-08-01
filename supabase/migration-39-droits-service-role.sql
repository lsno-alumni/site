-- Migration 39 — suite de la 38 : rétablir « service_role », et retirer aux rôles
-- publics deux pouvoirs qu'ils n'auraient jamais dû avoir.
--
-- Constat après la 38 (relevé sur information_schema.role_table_grants) :
--
--   • service_role avait perdu SELECT/INSERT/UPDATE/DELETE sur TOUT, sauf sur
--     push_abonnements. Rien n'était cassé par chance : la route /api/push ne
--     touche que cette table (dont le grant vient de la migration 30), et la
--     purge des fichiers d'offres passe par l'API Storage, pas par des tables.
--     Mais la moindre route serveur ajoutée demain aurait échoué.
--
--   • anon et authenticated détenaient TRUNCATE et TRIGGER sur toutes les tables.
--     TRUNCATE vide une table entière et **ignore la RLS** ; TRIGGER permet de
--     poser un déclencheur sur la table d'autrui. Aucun chemin ne permet de les
--     appeler via l'API PostgREST aujourd'hui — ce n'était donc pas exploitable —
--     mais ces pouvoirs n'ont aucune raison d'exister pour un visiteur ou un
--     membre. On les retire : le principe est de ne garder que ce qui sert.
--
-- Choix sur le journal : service_role peut le LIRE et y ÉCRIRE (une future route
-- serveur pourra journaliser), mais ni modifier ni supprimer une ligne. La
-- garantie d'« ajout seul » de la migration 36 reste donc entière, même pour la
-- clé de service.
--
-- Rejouable.

-- ---------- ① service_role : la clé de confiance du serveur ----------
-- Elle contourne la RLS par conception ; elle vit dans le Vault et dans les
-- variables Vercel, jamais dans le navigateur.
grant select, insert, update, delete on public.profiles         to service_role;
grant select, insert, update, delete on public.parcours         to service_role;
grant select, insert, update, delete on public.offres           to service_role;
grant select, insert, update, delete on public.offre_fichiers   to service_role;
grant select, insert, update, delete on public.demandes_contact to service_role;
grant select, insert, update, delete on public.push_abonnements to service_role;
grant select, insert, update, delete on public.annonces         to service_role;
grant select, insert, update, delete on public.annonce_envois   to service_role;
grant select, insert, update, delete on public.reglages         to service_role;
grant select on public.promotions to service_role;

-- le journal reste en ajout seul, même pour la clé de service
grant select, insert on public.journal to service_role;
revoke update, delete on public.journal from service_role;

grant usage, select on all sequences in schema public to service_role;

-- ---------- ② retirer TRUNCATE et TRIGGER aux rôles publics ----------
-- Rien dans l'application n'en a besoin : les suppressions passent par DELETE
-- (filtré par la RLS) et les déclencheurs sont créés par les migrations.
revoke truncate, trigger on all tables in schema public from anon, authenticated;

-- Vérification (le résultat ne doit plus contenir ni TRUNCATE ni TRIGGER pour
-- anon/authenticated, et service_role doit retrouver ses quatre droits) :
--   select grantee, table_name, string_agg(privilege_type, ',' order by privilege_type)
--     from information_schema.role_table_grants
--    where table_schema = 'public' and grantee in ('anon','authenticated','service_role')
--    group by grantee, table_name order by grantee, table_name;
