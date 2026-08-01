-- Migration 42 — DÉPANNER un compte bloqué par la double authentification, et
-- sortir la liste blanche du contrôle de santé dans une table.
--
-- Pourquoi : le texte de Mon profil promet qu'« un autre administrateur peut
-- rouvrir ton accès » si le téléphone est perdu. Rien ne le permettait dans
-- l'application — il fallait passer par l'éditeur SQL. Promesse tenue ici.
--
-- Trois précautions, toutes délibérées :
--   ① réservé aux ADMINS (pas aux délégués) : retirer la protection d'un compte
--      est plus lourd que valider une inscription ;
--   ② interdit sur SOI-MÊME : sinon la protection ne vaut plus rien — celui qui
--      vole une session d'admin la retirerait d'un clic. Pour son propre compte,
--      on passe par « Désactiver » dans Mon profil, qui exige d'avoir saisi
--      son code (Supabase refuse autrement : « AAL2 required ») ;
--   ③ journalisé ET alerté aux autres admins : c'est typiquement l'action qu'un
--      attaquant tenterait après avoir volé un mot de passe d'administrateur.
--
-- Second morceau : la liste blanche des fonctions appelables par le navigateur
-- était écrite EN DUR dans la vue sante_systeme, à deux endroits. Toute nouvelle
-- fonction obligeait donc à réécrire 250 lignes de vue. Elle devient une table :
-- une ligne à insérer suffira désormais.
--
-- Rejouable.

-- ---------- ① la liste blanche devient une table ----------
create table if not exists sante_fonctions_ouvertes (
  nom    text primary key,
  raison text not null
);

comment on table sante_fonctions_ouvertes is
  'Fonctions « security definer » que le navigateur a le droit d''appeler. Toute autre est signalée par la vue sante_systeme. Ajouter une ligne ici quand on crée une RPC appelée par le site.';

insert into sante_fonctions_ouvertes (nom, raison) values
  ('stats_publiques',      'vitrine publique : compteurs anonymes'),
  ('apercu_profil',        'aperçu d''un profil partagé (WhatsApp…)'),
  ('apercu_offre',         'aperçu d''une offre partagée'),
  ('contacts_de',          'contacts d''un membre, selon SA visibilité'),
  ('mes_contacts',         'mes propres coordonnées'),
  ('journal_export',       'déclaration d''un export de la base'),
  ('supprimer_mon_compte', 'auto-suppression, depuis Mon profil'),
  ('admin_change_email',   'back-office : changer un email de connexion'),
  ('admin_confirme_email', 'back-office : confirmer un email à la main'),
  ('admin_email_etat',     'back-office : lire l''email et son état'),
  ('admin_etat_systeme',   'back-office : état des tâches planifiées'),
  ('admin_mdp_temporaire', 'back-office : mot de passe temporaire'),
  ('admin_publie_annonce', 'back-office : publier une annonce'),
  ('admin_supprime_compte','back-office : supprimer un compte'),
  ('admin_test_push',      'back-office : tester les notifications'),
  ('admin_retire_2fa',     'back-office : dépanner un compte bloqué (migration 42)'),
  ('mon_role',             '⚠ citée par les politiques RLS'),
  ('mon_statut',           '⚠ citée par les politiques RLS'),
  ('est_admin',            '⚠ citée par les politiques RLS'),
  ('ma_promotion',         '⚠ citée par les politiques RLS')
on conflict (nom) do update set raison = excluded.raison;

alter table sante_fonctions_ouvertes enable row level security;

drop policy if exists sante_liste_lecture_admin on sante_fonctions_ouvertes;
create policy sante_liste_lecture_admin on sante_fonctions_ouvertes
  for select using (est_admin());

-- aucun droit aux clients : cette table décrit le modèle de sécurité
revoke all on sante_fonctions_ouvertes from anon, authenticated;

-- ---------- ② le dépannage ----------
create or replace function admin_retire_2fa(cible uuid) returns void
language plpgsql security definer set search_path = public, auth as $fn$
declare v_n int;
begin
  if not est_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  if cible = auth.uid() then
    raise exception 'Pour ton propre compte, passe par Mon profil — il faut avoir saisi ton code.';
  end if;

  delete from auth.mfa_factors where user_id = cible;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'Ce compte n''a aucun appareil d''authentification.';
  end if;

  -- journalisé, donc les AUTRES admins sont alertés (voir alerter_admins)
  perform journaliser('2fa_retire', cible, jsonb_build_object('appareils', v_n));
end $fn$;

-- ---------- ③ l'alerte doit connaître cette action ----------
-- Corps identique à la migration 41, avec « 2fa_retire » ajouté à la liste des
-- actions surveillées et sa formulation.
create or replace function alerter_admins(p_action text, p_cible uuid, p_details jsonb)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  v_acteur uuid := auth.uid();
  v_an text; v_cn text; v_quoi text; v_admins uuid[];
begin
  if p_action not in ('role','export','email_change','mdp_temporaire','suppression',
                      'reglage','2fa_retire') then
    return;
  end if;

  select prenom || ' ' || nom into v_an from profiles where id = v_acteur;
  select prenom || ' ' || nom into v_cn from profiles where id = p_cible;
  v_an := coalesce(v_an, '(système)');

  v_quoi := case p_action
    when 'role'           then 'a changé le rôle de ' || coalesce(v_cn, 'un membre')
                               || ' : ' || coalesce(p_details->>'avant', '?')
                               || ' → ' || coalesce(p_details->>'apres', '?')
    when 'export'         then 'a exporté l''annuaire (' || coalesce(p_details->>'profils', '?') || ' profils)'
    when 'email_change'   then 'a changé l''email de connexion de ' || coalesce(v_cn, 'un membre')
    when 'mdp_temporaire' then 'a posé un mot de passe temporaire pour ' || coalesce(v_cn, 'un membre')
    when 'suppression'    then 'a supprimé le compte de ' || coalesce(v_cn, 'un membre')
    when '2fa_retire'     then 'a retiré la double authentification de ' || coalesce(v_cn, 'un membre')
    when 'reglage'        then 'a modifié un réglage : ' || coalesce(p_details->>'cle', '?')
                               || ' → ' || case when coalesce((p_details->>'actif')::boolean, false)
                                                then 'activé' else 'désactivé' end
  end;

  select array_agg(id) into v_admins from profiles
   where role = 'admin' and statut_compte = 'valide'
     and (v_acteur is null or id <> v_acteur);
  if v_admins is null then return; end if;

  -- notification seule (pas d'email : événements rares, notif plus rapide), et
  -- SANS filtre de famille — une alerte de sécurité ne doit pas pouvoir être
  -- coupée par inadvertance dans les préférences.
  perform envoyer_push_liste(v_admins, 'Action d''administration',
    v_an || ' ' || v_quoi || '.', '/admin');
end $fn$;

revoke all on function alerter_admins(text, uuid, jsonb) from public, anon, authenticated;

-- ---------- ④ la vue lit désormais la table ----------
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
           and p.proname <> all ((select array_agg(nom) from sante_fonctions_ouvertes))
           and (has_function_privilege('authenticated', p.oid, 'EXECUTE')
                or has_function_privilege('anon', p.oid, 'EXECUTE')))::text || ' ouverte(s)',
       case when (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.prosecdef
                     and p.proname <> all ((select array_agg(nom) from sante_fonctions_ouvertes))
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
   and p.proname <> all ((select array_agg(nom) from sante_fonctions_ouvertes))
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

-- Vérification :
--   select controle_sante();                                   -- doit rester « ok »
--   select nom from sante_fonctions_ouvertes order by nom;      -- 20 lignes
