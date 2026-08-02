-- Migration 43 — rendre la vue sante_systeme compatible avec les versions
-- futures de PostgreSQL.
--
-- Trouvé par le banc d'essai local (outils/banc_essai.js), pas en production.
-- La vue écartait les fonctions autorisées avec :
--     p.proname <> all ((select array_agg(nom) from sante_fonctions_ouvertes))
-- PostgreSQL 15, celui de Supabase aujourd'hui, l'accepte. PostgreSQL 18, sur
-- lequel tourne le banc, le REFUSE : il lit « all (…) » comme une sous-requête
-- et non comme un tableau, et se plaint de comparer un nom à un tableau :
--     operator does not exist: name <> text[]
--
-- Rien n'est cassé aujourd'hui. Mais le jour où Supabase montera de version, la
-- vue tomberait — et avec elle le contrôle de santé mensuel, c'est-à-dire
-- justement le dispositif censé nous prévenir quand quelque chose casse.
-- On écrit donc la même chose sans ambiguïté, avec « not exists ». Résultat
-- identique, lisible par toutes les versions.
--
-- Rejouable. Ne change rien au contenu du contrôle.
create or replace view sante_systeme as
with
-- ---------- ce que chaque rôle DOIT pouvoir faire (source de vérité) ----------
attendu(role_, tbl, droits) as (values
  ('authenticated', 'profiles',         array['SELECT','INSERT','UPDATE','DELETE']),
  ('authenticated', 'parcours',         array['SELECT','INSERT','UPDATE','DELETE']),
  ('authenticated', 'promotions',       array['SELECT']),
  ('authenticated', 'offres',           array['SELECT','INSERT','UPDATE','DELETE']),
  ('authenticated', 'offre_fichiers',   array['SELECT','INSERT','DELETE']),
  ('authenticated', 'demandes_contact', array['SELECT','INSERT','UPDATE']),
  ('authenticated', 'push_abonnements', array['SELECT','INSERT','UPDATE','DELETE']),
  ('authenticated', 'annonces',         array['SELECT']),
  ('authenticated', 'annonce_envois',   array['SELECT']),
  ('authenticated', 'reglages',         array['SELECT','UPDATE']),
  ('authenticated', 'journal',          array['SELECT']),          -- ajout seul
  ('service_role',  'profiles',         array['SELECT','INSERT','UPDATE','DELETE']),
  ('service_role',  'parcours',         array['SELECT','INSERT','UPDATE','DELETE']),
  ('service_role',  'promotions',       array['SELECT']),
  ('service_role',  'offres',           array['SELECT','INSERT','UPDATE','DELETE']),
  ('service_role',  'offre_fichiers',   array['SELECT','INSERT','UPDATE','DELETE']),
  ('service_role',  'demandes_contact', array['SELECT','INSERT','UPDATE','DELETE']),
  ('service_role',  'push_abonnements', array['SELECT','INSERT','UPDATE','DELETE']),
  ('service_role',  'annonces',         array['SELECT','INSERT','UPDATE','DELETE']),
  ('service_role',  'annonce_envois',   array['SELECT','INSERT','UPDATE','DELETE']),
  ('service_role',  'reglages',         array['SELECT','INSERT','UPDATE','DELETE']),
  ('service_role',  'journal',          array['SELECT','INSERT'])  -- ajout seul aussi
),
reel as (
  select grantee::text as role_, table_name::text as tbl,
         array_agg(privilege_type::text order by privilege_type) as droits
    from information_schema.role_table_grants
   where table_schema = 'public'
     and grantee in ('anon','authenticated','service_role')
     and privilege_type in ('SELECT','INSERT','UPDATE','DELETE')
   group by 1, 2
),
attendu_trie as (
  select role_, tbl, (select array_agg(d order by d) from unnest(droits) d) as droits from attendu
),

-- ---------- ce qui est attendu ailleurs ----------
taches(nom) as (values
  ('rappel-annuel-profils'),('ouverture-promo-octobre'),('relance-inscriptions'),
  ('relance-demandes-contact'),('purge-comptes-fantomes'),('cloture-offres'),
  ('garde-vivant-brevo'),('envoi-annonces'),('purge-offres-cloturees'),
  ('push-rappels-quotidiens'),('push-rappel-annuel'),('push-controle-cles'),
  ('push-rentree-octobre'),('purge-journal'),('purge-refus'),
  ('controle-sante')
),
declencheurs(nom) as (values
  ('profiles_protege'),('profiles_journal'),('profiles_journal_suppression'),
  ('reglages_journal'),('profiles_push_statut'),('profiles_push_role'),
  ('profiles_push_identite'),('profiles_push_demande'),('profiles_notifie_validation'),
  ('profiles_notifie_role'),('profiles_notifie_demande'),('offres_horodate'),
  ('offres_push_nouvelle'),('demandes_contact_horodate'),('demandes_contact_push'),
  ('demandes_contact_notifie'),('demandes_contact_push_acceptation'),
  ('demandes_contact_notifie_acceptation')
),
ouvertes(nom, role_) as (values                   -- doivent rester appelables
  ('stats_publiques','anon'),('apercu_profil','anon'),('apercu_offre','anon'),
  ('journal_export','authenticated'),('admin_email_etat','authenticated'),
  ('admin_etat_systeme','authenticated'),('contacts_de','authenticated'),
  ('mes_contacts','authenticated'),('supprimer_mon_compte','authenticated'),
  ('mon_role','authenticated'),('est_admin','authenticated')
),
secrets(nom) as (values ('brevo_api_key'),('service_role_key'),('push_secret'))

select * from (

-- ---------- ① droits de table : manque-t-il quelque chose, y a-t-il du trop ? --
select '1. droits de table' as domaine,
       coalesce(a.role_, r.role_) || ' → ' || coalesce(a.tbl, r.tbl) as controle,
       coalesce(array_to_string(a.droits, ','), '(aucun)') as attendu,
       coalesce(array_to_string(r.droits, ','), '(aucun)') as constate,
       case
         when a.droits is null then 'PROBLÈME — droits non prévus par le modèle'
         when r.droits is null then 'PROBLÈME — tous les droits ont disparu'
         when a.droits = r.droits then 'ok'
         -- nullif : un array_to_string vide renvoie '' et non NULL — sans lui,
         -- le verdict afficherait « manque » suivi de rien
         else 'PROBLÈME —' ||
              coalesce(' manque ' || nullif(array_to_string(array(
                select unnest(a.droits) except select unnest(r.droits)), ','), ''), '') ||
              coalesce(' en trop ' || nullif(array_to_string(array(
                select unnest(r.droits) except select unnest(a.droits)), ','), ''), '')
       end as verdict
  from attendu_trie a full outer join reel r on r.role_ = a.role_ and r.tbl = a.tbl

union all
-- ---------- ② anon ne doit toucher AUCUNE table ----------
select '2. rôle anonyme', 'anon sur les tables', 'aucun droit de données',
       count(*)::text || ' droit(s) trouvé(s)' ||
         coalesce(' : ' || string_agg(distinct table_name, ', '), ''),
       case when count(*) = 0 then 'ok'
            else 'PROBLÈME — un visiteur non connecté ne doit rien lire ni écrire' end
  from information_schema.role_table_grants
 where table_schema = 'public' and grantee = 'anon'
   and privilege_type in ('SELECT','INSERT','UPDATE','DELETE')

union all
-- ---------- ③ TRUNCATE / TRIGGER : pouvoirs qui ignorent la RLS ----------
select '3. pouvoirs dangereux', r.rolname || ' : TRUNCATE / TRIGGER', 'aucun',
       (select count(*) from information_schema.role_table_grants g
         where g.table_schema = 'public' and g.grantee = r.rolname
           and g.privilege_type in ('TRUNCATE','TRIGGER'))::text || ' droit(s)',
       case when (select count(*) from information_schema.role_table_grants g
                   where g.table_schema = 'public' and g.grantee = r.rolname
                     and g.privilege_type in ('TRUNCATE','TRIGGER')) = 0 then 'ok'
            else 'PROBLÈME — TRUNCATE vide une table entière en ignorant la RLS' end
  from pg_roles r where r.rolname in ('anon','authenticated')

union all
-- ---------- ④ RLS active et politiques présentes sur chaque table ----------
select '4. RLS', c.relname, 'activée + au moins 1 politique',
       case when c.relrowsecurity then 'activée' else 'DÉSACTIVÉE' end ||
       ', ' || (select count(*) from pg_policies p
                 where p.schemaname = 'public' and p.tablename = c.relname)::text || ' politique(s)',
       case when not c.relrowsecurity then 'PROBLÈME — RLS désactivée'
            when (select count(*) from pg_policies p
                   where p.schemaname = 'public' and p.tablename = c.relname) = 0
              then 'PROBLÈME — aucune politique : la table est fermée à tous'
            else 'ok' end
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'

union all
-- ---------- ⑤ séquences : sans elles, tout ajout échoue ----------
select '5. séquences', r.rolname || ' → séquences', 'USAGE sur toutes',
       (select count(*) from information_schema.usage_privileges u
         where u.object_schema = 'public' and u.object_type = 'SEQUENCE'
           and u.grantee = r.rolname and u.privilege_type = 'USAGE')::text
       || ' sur ' ||
       (select count(*) from information_schema.sequences q
         where q.sequence_schema = 'public')::text,
       case when (select count(*) from information_schema.sequences q
                   where q.sequence_schema = 'public')
                 = (select count(*) from information_schema.usage_privileges u
                     where u.object_schema = 'public' and u.object_type = 'SEQUENCE'
                       and u.grantee = r.rolname and u.privilege_type = 'USAGE')
            then 'ok'
            else 'PROBLÈME — un INSERT échouera avec « permission denied for sequence »' end
  from pg_roles r where r.rolname in ('authenticated','service_role')

union all
-- ---------- ⑥ fonctions internes ouvertes aux clients (contrôle DYNAMIQUE) ------
-- Plus de liste figée à maintenir : on regarde TOUTES les fonctions « security
-- definer » du schéma public — celles qui s'exécutent avec les droits de leur
-- propriétaire — et on signale toute fonction appelable par un client sans être
-- dans la liste blanche. Une fonction interne ajoutée demain et laissée ouverte
-- sera donc détectée sans que personne ait à y penser.
select '6. fonctions verrouillées', 'bilan', 'aucune fonction interne ouverte',
       (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.prosecdef
           and not exists (select 1 from sante_fonctions_ouvertes o where o.nom = p.proname)
           and (has_function_privilege('authenticated', p.oid, 'EXECUTE')
                or has_function_privilege('anon', p.oid, 'EXECUTE')))::text || ' ouverte(s)',
       case when (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.prosecdef
                     and not exists (select 1 from sante_fonctions_ouvertes o where o.nom = p.proname)
                     and (has_function_privilege('authenticated', p.oid, 'EXECUTE')
                          or has_function_privilege('anon', p.oid, 'EXECUTE'))) = 0
            then 'ok' else 'PROBLÈME — voir les lignes suivantes' end

union all
select '6. fonctions verrouillées', p.proname || '()', 'inexécutable par anon et authenticated',
       case when has_function_privilege('authenticated', p.oid, 'EXECUTE')
            then 'authenticated PEUT l''appeler' else 'anon PEUT l''appeler' end,
       'PROBLÈME — fonction interne ouverte : un membre pourrait l''appeler directement'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prosecdef
   and not exists (select 1 from sante_fonctions_ouvertes o where o.nom = p.proname)
   and (has_function_privilege('authenticated', p.oid, 'EXECUTE')
        or has_function_privilege('anon', p.oid, 'EXECUTE'))

union all
-- ---------- ⑦ fonctions qui doivent rester appelables ----------
select '7. fonctions ouvertes', o.nom || '() pour ' || o.role_, 'exécutable',
       case when p.oid is null then 'FONCTION ABSENTE'
            when has_function_privilege(o.role_, p.oid, 'EXECUTE') then 'exécutable'
            else 'REFUSÉE' end,
       case when p.oid is null then 'PROBLÈME — fonction absente'
            when has_function_privilege(o.role_, p.oid, 'EXECUTE') then 'ok'
            else 'PROBLÈME — une page du site va échouer' end
  from ouvertes o
  left join (select p.oid, p.proname from pg_proc p
               join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public') p
    on p.proname = o.nom

union all
-- ---------- ⑧ tâches planifiées ----------
select '8. tâches planifiées', t.nom, 'planifiée et active',
       coalesce(case when j.active then 'active (' || j.schedule || ')' else 'INACTIVE' end, 'ABSENTE'),
       case when j.jobname is null then 'PROBLÈME — tâche absente'
            when not j.active then 'PROBLÈME — tâche désactivée'
            else 'ok' end
  from taches t left join cron.job j on j.jobname = t.nom

union all
-- ---------- ⑨ déclencheurs ----------
select '9. déclencheurs', d.nom, 'présent',
       coalesce((select 'sur ' || c.relname from pg_trigger g
                  join pg_class c on c.oid = g.tgrelid
                 where g.tgname = d.nom and not g.tgisinternal limit 1), 'ABSENT'),
       case when exists (select 1 from pg_trigger g where g.tgname = d.nom and not g.tgisinternal)
            then 'ok' else 'PROBLÈME — déclencheur absent' end
  from declencheurs d

union all
-- ---------- ⑩ secrets du Vault (noms seulement, jamais les valeurs) ----------
select '10. secrets', s.nom, 'présent dans le Vault',
       case when exists (select 1 from vault.decrypted_secrets v where v.name = s.nom)
            then 'présent' else 'ABSENT' end,
       case when exists (select 1 from vault.decrypted_secrets v where v.name = s.nom)
            then 'ok' else 'PROBLÈME — email, push ou purge des fichiers cassé' end
  from secrets s

union all
-- ---------- ⑪ colonnes et table dont dépend le code déployé ----------
select '11. schéma', x.quoi, 'présent',
       case when x.present then 'présent' else 'ABSENT' end,
       case when x.present then 'ok' else 'PROBLÈME — le code déployé s''attend à le trouver' end
  from (values
    ('profiles.valide_le', exists (select 1 from information_schema.columns
       where table_schema='public' and table_name='profiles' and column_name='valide_le')),
    ('profiles.refuse_le', exists (select 1 from information_schema.columns
       where table_schema='public' and table_name='profiles' and column_name='refuse_le')),
    ('table journal', exists (select 1 from information_schema.tables
       where table_schema='public' and table_name='journal'))
  ) as x(quoi, present)

) as controles
-- les problèmes remontent en tête, quelle que soit la collation de la base
order by (verdict like 'PROBL%') desc, domaine, controle;

revoke all on sante_systeme from anon, authenticated;

-- Vérification :  select controle_sante();   -- doit rester « ok »
