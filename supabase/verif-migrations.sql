-- Vérifier qu'AUCUNE migration n'a été sautée.
--
-- Pourquoi ce fichier : le 02/08, la migration 42 n'avait jamais été exécutée
-- alors que le suivi la disait faite. Personne ne s'en était aperçu — le bouton
-- de dépannage de la double authentification appelait une fonction absente.
-- Le banc d'essai ne peut PAS détecter ça : il rejoue tous les fichiers, il ne
-- sait pas lesquels ont réellement tourné sur la vraie base.
--
-- Principe : chaque migration laisse une TRACE en base (une table, une colonne,
-- une fonction, un déclencheur, une tâche, une politique, un droit). On cherche
-- cette trace. Une ligne « MANQUE » = migration à exécuter.
--
-- Lecture attentive : quelques migrations RÉÉCRIVENT une fonction créée plus
-- tôt. On vérifie alors un morceau du nouveau texte, pas la simple présence —
-- sinon l'ancienne version passerait pour la nouvelle.
--
-- À lancer dans l'éditeur SQL Supabase. Ne modifie rien.

with attendu(num, laisse, present) as (

  select 2, 'politiques Storage du bucket photos',
    exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'photos_lecture')
  union all select 3, 'fonctions mes_contacts() et contacts_de()',
    to_regprocedure('public.mes_contacts()') is not null
  union all select 4, 'envoyer_email() + déclencheur de nouvelle demande',
    to_regprocedure('public.envoyer_email(text,text,text,text)') is not null
    or exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'envoyer_email')
  union all select 5, 'déclencheur profiles_notifie_role',
    exists (select 1 from pg_trigger where tgname = 'profiles_notifie_role' and not tgisinternal)
  union all select 6, 'gabarit_sobre() (remplacé par la 07, la fonction reste)',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'gabarit_sobre')
  union all select 7, 'email de rôle revenu à la charte (gabarit_email)',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'notifie_changement_role' and p.prosrc like '%gabarit_email%')
  union all select 8, 'supprimer_mon_compte()',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'supprimer_mon_compte')
  union all select 9, 'correctif : la photo ne se supprime plus en SQL',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'supprimer_mon_compte' and p.prosrc not like '%storage.objects%')
  union all select 10, 'table demandes_contact',
    to_regclass('public.demandes_contact') is not null
  union all select 11, 'table offres',
    to_regclass('public.offres') is not null
  union all select 12, 'stats_publiques enrichie (par_pays)',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'stats_publiques' and p.prosrc like '%par_pays%')
  union all select 13, 'colonne profiles.rappel_envoye_le + tâche du rappel annuel',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'rappel_envoye_le')
  union all select 14, 'tâche ouverture-promo-octobre',
    exists (select 1 from cron.job where jobname = 'ouverture-promo-octobre')
  union all select 15, 'les 5 tâches d''entretien (relances, purges, garde-vivant)',
    exists (select 1 from cron.job where jobname = 'garde-vivant-brevo')
  union all select 16, 'colonnes profiles.histoire et sujets_cadets',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'sujets_cadets')
  union all select 17, 'colonne profiles.domaine_precision',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'domaine_precision')
  union all select 18, 'outils admin (est_admin, mot de passe temporaire…)',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'admin_mdp_temporaire')
  union all select 19, 'tables annonces + annonce_envois',
    to_regclass('public.annonces') is not null
  union all select 20, 'apercu_profil() (partage)',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'apercu_profil')
  union all select 21, 'apercu_offre() (partage)',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'apercu_offre')
  union all select 22, 'colonne profiles.conseil_theme',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'conseil_theme')
  union all select 23, 'valeur « eleve » dans le type situation_t',
    exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'situation_t' and e.enumlabel = 'eleve')
  union all select 24, 'handle_new_user() gère la situation « élève »',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'handle_new_user' and p.prosrc like '%situation%')
  union all select 25, 'table offre_fichiers (pièces jointes)',
    to_regclass('public.offre_fichiers') is not null
  union all select 26, 'tâche purge-offres-cloturees',
    exists (select 1 from cron.job where jobname = 'purge-offres-cloturees')
  union all select 27, 'table reglages (interrupteur des emails admins)',
    to_regclass('public.reglages') is not null
  union all select 28, 'table push_abonnements',
    to_regclass('public.push_abonnements') is not null
  union all select 29, 'politique de mise à jour des abonnements push',
    exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'push_abonnements' and policyname = 'push_abo_maj')
  union all select 30, 'droits service_role sur push_abonnements',
    has_table_privilege('service_role', 'public.push_abonnements', 'select')
  union all select 31, 'les 4 tâches push + relance corrigée',
    exists (select 1 from cron.job where jobname = 'push-rappels-quotidiens')
    and exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname = 'relance_inscriptions_en_attente' and p.prosrc like '%reglage_actif%')
  union all select 32, 'colonne profiles.push_reseau_portee + nom_domaine()',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'push_reseau_portee')
  union all select 33, 'envoyer_push_liste() (envoi par lots de 50)',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'envoyer_push_liste')
  union all select 34, 'valide_le posé uniquement au passage à « validé »',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'protege_colonnes' and p.prosrc like '%valide_le%')
  union all select 35, 'admin_email_etat() (état de confirmation de l''email)',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'admin_email_etat')
  union all select 36, 'table journal + tâche de purge à 12 mois',
    to_regclass('public.journal') is not null
  union all select 37, 'colonne profiles.refuse_le + purge des refus',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'refuse_le')
  union all select 38, 'droits de table rendus au rôle authenticated',
    has_table_privilege('authenticated', 'public.profiles', 'select')
    and has_table_privilege('authenticated', 'public.parcours', 'insert')
  union all select 39, 'droits de table du rôle service_role',
    has_table_privilege('service_role', 'public.profiles', 'select')
    and has_table_privilege('service_role', 'public.annonces', 'select')
  union all select 40, 'vue sante_systeme + tâche mensuelle',
    to_regclass('public.sante_systeme') is not null
    and exists (select 1 from cron.job where jobname = 'controle-sante')
  union all select 41, 'alerter_admins() branchée dans journaliser()',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'journaliser' and p.prosrc like '%alerter_admins%')
  union all select 42, 'admin_retire_2fa() + table sante_fonctions_ouvertes',
    to_regclass('public.sante_fonctions_ouvertes') is not null
    and exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'admin_retire_2fa')
  union all select 45, 'la notification d''inscription a son propre interrupteur',
    exists (select 1 from reglages where cle = 'push_inscription_admins')
    and exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname = 'push_nouvelle_demande'
                  and p.prosrc like '%push_inscription_admins%')
  union all select 44, 'admin_email_etat() renvoie aussi l''état de la double auth',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'admin_email_etat' and p.prosrc like '%mfa_factors%')
  union all select 43, 'vue de santé écrite sans « <> all » (compatible PG 18)',
    case when to_regclass('public.sante_systeme') is null then false
         else pg_get_viewdef('public.sante_systeme'::regclass) not like '%array_agg(sante_fonctions_ouvertes.nom)%'
    end
)
select num                                         as "migration",
       laisse                                      as "trace attendue en base",
       case when present then 'ok' else 'MANQUE' end as "etat"
from attendu
order by present, num;   -- les manquantes remontent en tête
