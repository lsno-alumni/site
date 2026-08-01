-- Migration 36 — JOURNAL DES ACTIONS À PRIVILÈGE : qui a fait quoi, et quand.
--
-- Pourquoi : aucune trace ne survivait aux actions les plus sensibles. Une
-- suppression de compte ne laissait rien du tout, un export de toute la base
-- non plus, et valide_par/valide_le ne gardent par construction que le DERNIER
-- événement (une colonne ne peut pas contenir un historique).
--
-- Choix de conception, tous volontaires :
--
--  ① AJOUT SEUL. Aucune politique d'insertion, de modification ni de suppression :
--     depuis le navigateur, personne ne peut écrire ni retoucher une ligne, pas
--     même un admin. Les écritures passent par journaliser(), en security
--     definer, appelée par des déclencheurs et par les fonctions admin.
--
--  ② PAS DE CLÉ ÉTRANGÈRE vers profiles, ni pour l'auteur ni pour la cible, et
--     une COPIE DU NOM des deux. Avec une clé étrangère, supprimer un compte
--     effacerait (ou viderait) les lignes qui le concernent — précisément les
--     plus intéressantes.
--
--  ③ SEULES LES ACTIONS À PRIVILÈGE. Ce qu'un membre fait sur son propre profil
--     n'est pas journalisé : ce serait de la surveillance, contraire à la
--     promesse de confidentialité, et ça noierait l'utile sous le bruit.
--
--  ④ 12 MOIS puis purge automatique (cron purge-journal) : on ne conserve pas
--     indéfiniment des données personnelles. La page Conditions le mentionne.
--
-- Ce qui n'est PAS couvert, et pourquoi : les tentatives refusées. Le rejet
-- annule la transaction, donc la ligne de journal écrite au même moment
-- disparaîtrait avec elle. Il faudrait un appel hors transaction.
--
-- Rejouable.

-- ---------- ① la table ----------
create table if not exists journal (
  id         bigserial primary key,
  quand      timestamptz not null default now(),
  acteur     uuid,                     -- volontairement SANS référence
  acteur_nom text,                     -- copie : survit à la suppression du compte
  action     text not null,
  cible      uuid,
  cible_nom  text,
  details    jsonb not null default '{}'::jsonb
);

create index if not exists journal_quand_idx on journal (quand desc);
create index if not exists journal_cible_idx on journal (cible, quand desc);

alter table journal enable row level security;

-- lecture réservée aux admins ; aucune autre politique = aucune écriture directe
drop policy if exists journal_lecture_admin on journal;
create policy journal_lecture_admin on journal for select using (est_admin());

grant select on journal to authenticated;
revoke insert, update, delete on journal from authenticated;

-- ---------- ② l'écriture ----------
create or replace function journaliser(p_action text, p_cible uuid,
                                       p_details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_acteur uuid := auth.uid(); v_an text; v_cn text;
begin
  select prenom || ' ' || nom into v_an from profiles where id = v_acteur;
  select prenom || ' ' || nom into v_cn from profiles where id = p_cible;
  insert into journal (acteur, acteur_nom, action, cible, cible_nom, details)
  values (v_acteur, coalesce(v_an, '(système)'), p_action, p_cible, v_cn,
          coalesce(p_details, '{}'::jsonb));
end $$;

-- ⚠ Indispensable : sans ce revoke, n'importe quel membre connecté pourrait
-- appeler journaliser() en RPC et FORGER des lignes de journal. Les appels
-- internes continuent de fonctionner : les fonctions appelantes sont elles aussi
-- « security definer », donc exécutées avec les droits du propriétaire.
revoke all on function journaliser(text, uuid, jsonb) from public, anon, authenticated;

-- ---------- ③ statut et rôle : déclencheur sur profiles ----------
-- Il n'existe pas de statut « refusé » : refuser une demande met le compte à
-- « suspendu ». L'action se déduit donc du couple avant → après.
create or replace function journal_profil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.statut_compte is distinct from old.statut_compte then
    perform journaliser(
      case
        when old.statut_compte = 'en_attente' and new.statut_compte = 'valide'   then 'validation'
        when old.statut_compte = 'en_attente' and new.statut_compte = 'suspendu' then 'refus'
        when old.statut_compte = 'valide'     and new.statut_compte = 'suspendu' then 'suspension'
        when old.statut_compte = 'suspendu'   and new.statut_compte = 'valide'   then 'reactivation'
        else 'statut'
      end,
      new.id,
      jsonb_build_object('avant', old.statut_compte, 'apres', new.statut_compte)
    );
  end if;
  if new.role is distinct from old.role then
    perform journaliser('role', new.id,
      jsonb_build_object('avant', old.role, 'apres', new.role));
  end if;
  return null;              -- déclencheur AFTER : la valeur retournée est ignorée
end $$;

drop trigger if exists profiles_journal on profiles;
create trigger profiles_journal after update on profiles
  for each row execute function journal_profil();

-- ---------- ③ bis. suppression d'un compte ----------
-- Un déclencheur plutôt qu'un appel dans la fonction admin : il couvre TOUS les
-- chemins (suppression par un admin, auto-suppression par le membre, purge
-- automatique des comptes jamais confirmés). L'insertion se fait ici avec les
-- valeurs de OLD : journaliser() irait chercher le nom dans profiles, où la
-- ligne vient justement de disparaître.
create or replace function journal_suppression() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_acteur uuid := auth.uid(); v_an text;
begin
  select prenom || ' ' || nom into v_an from profiles where id = v_acteur;
  insert into journal (acteur, acteur_nom, action, cible, cible_nom, details)
  values (v_acteur, coalesce(v_an, '(système)'),
          case when v_acteur = old.id then 'suppression_soi' else 'suppression' end,
          old.id, old.prenom || ' ' || old.nom,
          jsonb_build_object('role', old.role, 'statut', old.statut_compte));
  return null;              -- obligatoire : sans RETURN, Postgres lève une erreur
end $$;

drop trigger if exists profiles_journal_suppression on profiles;
create trigger profiles_journal_suppression after delete on profiles
  for each row execute function journal_suppression();

revoke all on function journal_profil() from public, anon, authenticated;
revoke all on function journal_suppression() from public, anon, authenticated;

-- ---------- ④ interrupteur des réglages ----------
create or replace function journal_reglage() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.actif is distinct from old.actif then
    perform journaliser('reglage', null,
      jsonb_build_object('cle', new.cle, 'actif', new.actif));
  end if;
  return null;
end $$;

drop trigger if exists reglages_journal on reglages;
create trigger reglages_journal after update on reglages
  for each row execute function journal_reglage();

revoke all on function journal_reglage() from public, anon, authenticated;

-- ---------- ⑤ export de la base ----------
-- Une lecture ne se journalise pas par déclencheur : c'est l'app qui déclare
-- l'export. Trace de responsabilité, pas verrou — un délégué a de toute façon
-- le droit de lire l'annuaire.
create or replace function journal_export(p_profils int, p_parcours int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if mon_role() not in ('delegue', 'admin') then
    raise exception 'Réservé aux délégués et administrateurs.';
  end if;
  perform journaliser('export', null,
    jsonb_build_object('profils', p_profils, 'parcours', p_parcours));
end $$;

-- ---------- ⑥ fonctions admin instrumentées ----------
-- Corps identiques aux versions en place, avec l'appel à journaliser() ajouté.

create or replace function admin_confirme_email(cible uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not est_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  update auth.users
     set email_confirmed_at = coalesce(email_confirmed_at, now())
   where id = cible;
  perform journaliser('email_confirme', cible);
end $$;

create or replace function admin_mdp_temporaire(cible uuid, nouveau text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not est_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  if char_length(nouveau) < 8 then
    raise exception 'Mot de passe trop court (8 caractères minimum).';
  end if;
  update auth.users
     set encrypted_password = crypt(nouveau, gen_salt('bf'))
   where id = cible;
  -- le mot de passe lui-même n'est évidemment PAS journalisé
  perform journaliser('mdp_temporaire', cible);
end $$;

create or replace function admin_change_email(cible uuid, nouvel_email text) returns void
language plpgsql security definer set search_path = public as $$
declare v_ancien text;
begin
  if not est_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  nouvel_email := lower(trim(nouvel_email));
  if nouvel_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Adresse email invalide.';
  end if;
  if exists (select 1 from auth.users where lower(email) = nouvel_email and id <> cible) then
    raise exception 'Cette adresse est déjà utilisée par un autre compte.';
  end if;
  select email into v_ancien from auth.users where id = cible;
  update auth.users
     set email = nouvel_email, email_confirmed_at = coalesce(email_confirmed_at, now())
   where id = cible;
  update auth.identities
     set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(nouvel_email))
   where user_id = cible and provider = 'email';
  -- les deux adresses SONT conservées : détourner un compte vers une autre
  -- boîte est précisément l'abus que ce journal doit rendre visible
  perform journaliser('email_change', cible,
    jsonb_build_object('avant', v_ancien, 'apres', nouvel_email));
end $$;

create or replace function admin_publie_annonce(p_sujet text, p_corps text) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not est_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  if exists (select 1 from annonces where not terminee) then
    raise exception 'Une annonce est déjà en cours d''envoi — attends qu''elle se termine.';
  end if;
  insert into annonces (sujet, corps, cree_par) values (trim(p_sujet), trim(p_corps), auth.uid())
    returning id into v_id;
  perform envoyer_annonces();
  perform envoyer_push_liste(membres_valides(), trim(p_sujet),
    left(trim(p_corps), 140), '/', 'annonces');
  perform journaliser('annonce', null,
    jsonb_build_object('annonce', v_id, 'sujet', trim(p_sujet)));
  return v_id;
end $$;

-- ---------- ⑦ purge à 12 mois ----------
create or replace function purge_journal() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from journal where quand < now() - interval '12 months';
end $$;

revoke all on function purge_journal() from public, anon, authenticated;

-- 1er du mois à 04:30 UTC, avant les autres jobs mensuels (05:xx et 06:00).
-- cron.schedule remplace un job de même nom : la migration reste rejouable.
select cron.schedule('purge-journal', '30 4 1 * *', $$select purge_journal();$$);

-- Vérification :
--   select count(*) from journal;                  -- 0 au départ
--   select jobname from cron.job order by jobname; -- 14 jobs attendus
