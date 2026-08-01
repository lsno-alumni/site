-- Migration 40 — CONTRÔLE DE SANTÉ MENSUEL : la base se surveille elle-même.
--
-- Pourquoi : le 01/08, le rôle « authenticated » a perdu ses privilèges de table
-- et PERSONNE ne l'a su pendant des heures — jusqu'à ce qu'un onglet cesse de
-- s'afficher. Le symptôme ne ressemblait même pas à un problème de droits.
-- Un contrôle régulier aurait signalé la chose le jour même.
--
-- Deux morceaux :
--
--   ① la VUE sante_systeme — source de vérité UNIQUE du modèle attendu (droits,
--      RLS, fonctions verrouillées, fonctions ouvertes, tâches, déclencheurs,
--      secrets, schéma). Elle ne lit que des catalogues, ne modifie rien, et sert
--      à la fois au contrôle manuel (supabase/verif-sante.sql) et à la tâche
--      mensuelle. Un seul endroit à mettre à jour quand le modèle évolue.
--
--   ② la fonction controle_sante() — lit la vue, et s'il y a le moindre problème
--      prévient TOUS les admins par email et par notification, avec la liste.
--      Silencieuse quand tout va bien : une alerte qui crie pour rien n'est plus lue.
--      Elle écrit toujours au journal, y compris quand tout va bien : c'est la
--      preuve que le contrôle a bien tourné (un contrôle muet ne se distingue pas
--      d'un contrôle jamais exécuté).
--
-- La vue reste FERMÉE aux clients : elle décrit le modèle de sécurité, ce n'est
-- pas une information à exposer au navigateur.
--
-- Rejouable.

-- ---------- ① la vue ----------
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
verrouillees(nom) as (values                      -- jamais appelables par un client
  ('journaliser'),('journal_profil'),('journal_suppression'),('journal_reglage'),
  ('purge_journal'),('purge_refus_anciens'),('purge_offres_cloturees')
),
ouvertes(nom, role_) as (values                   -- doivent rester appelables
  ('stats_publiques','anon'),('apercu_profil','anon'),('apercu_offre','anon'),
  ('journal_export','authenticated'),('admin_email_etat','authenticated'),
  ('admin_etat_systeme','authenticated'),('contacts_de','authenticated')
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
-- ---------- ⑥ fonctions qui ne doivent PAS être appelables par un client ------
select '6. fonctions verrouillées', v.nom || '()', 'inexécutable par anon et authenticated',
       case when p.oid is null then 'FONCTION ABSENTE'
            when has_function_privilege('authenticated', p.oid, 'EXECUTE') then 'authenticated PEUT l''appeler'
            when has_function_privilege('anon', p.oid, 'EXECUTE') then 'anon PEUT l''appeler'
            else 'verrouillée' end,
       case when p.oid is null then 'PROBLÈME — fonction absente'
            when has_function_privilege('authenticated', p.oid, 'EXECUTE')
              or has_function_privilege('anon', p.oid, 'EXECUTE')
            then 'PROBLÈME — un membre pourrait l''appeler directement (forger un journal, purger…)'
            else 'ok' end
  from verrouillees v
  left join (select p.oid, p.proname from pg_proc p
               join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public') p
    on p.proname = v.nom

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

-- ---------- ② le contrôle mensuel ----------
-- Renvoie son rapport en texte : « select controle_sante(); » à la main donne
-- immédiatement l'état, sans attendre le 1er du mois.
create or replace function controle_sante() returns text
language plpgsql security definer set search_path = public as $$
declare
  soucis text[] := '{}';
  v record;
  n int;
  corps text;
begin
  for v in select domaine, controle, attendu, constate, verdict
             from sante_systeme where verdict like 'PROBL%'
            order by domaine, controle
  loop
    soucis := soucis || (v.domaine || ' · ' || v.controle || ' : ' || v.verdict
                         || ' (attendu ' || v.attendu || ', constaté ' || v.constate || ')');
  end loop;

  n := coalesce(array_length(soucis, 1), 0);

  -- trace systématique : elle prouve que le contrôle a tourné
  perform journaliser('controle_sante', null, jsonb_build_object('soucis', n));

  if n = 0 then
    return 'ok — aucun problème';
  end if;

  corps := 'Le contrôle automatique de la base a relevé <b>' || n
        || ' problème(s)</b> :<br><br>• ' || array_to_string(soucis, '<br>• ')
        || '<br><br>Le détail complet est dans <i>supabase/verif-sante.sql</i> '
        || '(à coller dans l''éditeur SQL), et la marche à suivre dans CONTRIBUTING '
        || '(§ Pièges connus). Cas le plus fréquent : une migration contenant du DDL '
        || 'a retiré des privilèges — les rétablir avec migration-38 et migration-39.';

  for v in
    select u.email, p.prenom
      from profiles p join auth.users u on u.id = p.id
     where p.role = 'admin' and p.statut_compte = 'valide'
  loop
    perform envoyer_email(
      v.email, v.prenom,
      'LSNO Amicale — le contrôle de la base a relevé ' || n || ' problème(s)',
      gabarit_email('Contrôle de la base : ' || n || ' problème(s)', corps,
                    'Ouvrir le site', 'https://lsno-alumni.vercel.app/admin'));
  end loop;

  perform envoyer_push_liste(
    (select array_agg(id) from profiles where role = 'admin' and statut_compte = 'valide'),
    'Contrôle de la base : ' || n || ' problème(s)',
    'Des droits ou des tâches ne sont plus conformes — regarde tes emails.',
    '/admin', 'annonces');

  return array_to_string(soucis, chr(10));
end $$;

revoke all on function controle_sante() from public, anon, authenticated;

-- 1er du mois à 8h UTC : après toutes les purges (4h30 → 6h), donc l'état
-- contrôlé est celui d'après leur passage.
select cron.schedule('controle-sante', '0 8 1 * *', $$select controle_sante();$$);

-- Vérification immédiate, sans attendre le 1er du mois :
--   select controle_sante();     -- doit renvoyer « ok — aucun problème »
