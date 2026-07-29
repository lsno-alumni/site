-- ============================================================
-- Migration 31 — PHASE 2 : les 20 événements branchés en notification push
--
--  Règles retenues avec l'utilisateur :
--   • les emails existants (A) restent INCHANGÉS, le push vient en plus ;
--   • les nouveaux événements (B) sont en push SEUL ;
--   • A12 garde impérativement son email (c'est lui qui maintient la clé Brevo) ;
--   • B2 abandonné ; B5 et B6 fusionnés en une seule notification.
--
--  ⚠️ CORRECTIF au passage : la migration 27 avait créé « relance_inscriptions »
--  alors que le cron du lundi appelle « relance_inscriptions_en_attente ».
--  L'interrupteur des emails admins ne s'appliquait donc PAS à la relance
--  hebdomadaire. Corrigé ici (et la fonction orpheline est supprimée).
--
--  ⚠️ À DÉPLOYER APRÈS la mise en ligne de la route /api/push en mode « lot »
--  (elle doit accepter le champ « profils »).
--
--  Choix de conception : les envois par push sont dans des fonctions/triggers
--  SÉPARÉS des envois d'emails — aucun risque de régression sur les emails.
--  En contrepartie, si une règle de destinataires change, penser aux deux.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Envoi par LOTS (indispensable pour les diffusions à tout le réseau :
--    un appel HTTP par membre saturerait pg_net et la limite de temps Vercel)
-- ------------------------------------------------------------
create or replace function envoyer_push_liste(
  p_profils uuid[], p_titre text, p_corps text, p_url text default '/', p_famille text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  cle    text;
  cibles uuid[];
  lot    uuid[];
  n      int;
begin
  if p_profils is null or array_length(p_profils, 1) is null then return; end if;
  select decrypted_secret into cle from vault.decrypted_secrets where name = 'push_secret';
  if cle is null then return; end if;

  -- ne garder que ceux qui ont au moins un appareil abonné ET qui acceptent
  -- cette famille de notifications
  if p_famille is null then
    select array_agg(distinct profil) into cibles
      from push_abonnements where profil = any(p_profils);
  else
    execute format($f$
      select array_agg(distinct a.profil)
        from push_abonnements a join profiles p on p.id = a.profil
       where a.profil = any($1) and coalesce(p.push_%I, true)
    $f$, p_famille) into cibles using p_profils;
  end if;

  while cibles is not null and array_length(cibles, 1) > 0 loop
    n := least(50, array_length(cibles, 1));
    lot := cibles[1:n];
    cibles := cibles[n + 1 : array_length(cibles, 1)];
    perform net.http_post(
      url     := 'https://lsno-alumni.vercel.app/api/push',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cle-push', cle),
      body    := jsonb_build_object('profils', to_jsonb(lot), 'titre', p_titre,
                                    'corps', p_corps, 'url', coalesce(p_url, '/')));
  end loop;
exception when others then
  null;  -- une notification ne doit jamais faire échouer l'action d'origine
end $$;

revoke all on function envoyer_push_liste(uuid[], text, text, text, text) from public, anon, authenticated;

-- un seul destinataire = un lot de un (une seule voie de code)
create or replace function envoyer_push(
  p_profil uuid, p_titre text, p_corps text, p_url text default '/', p_famille text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  perform envoyer_push_liste(array[p_profil], p_titre, p_corps, p_url, p_famille);
end $$;

revoke all on function envoyer_push(uuid, text, text, text, text) from public, anon, authenticated;

-- tous les membres validés (raccourci des diffusions)
create or replace function membres_valides() returns uuid[]
language sql stable security definer set search_path = public as $$
  select array_agg(id) from profiles where statut_compte = 'valide'
$$;

-- ------------------------------------------------------------
-- 2. Mémoire du rappel « profil incomplet » (B10, une seule fois)
-- ------------------------------------------------------------
alter table profiles add column if not exists rappel_incomplet_le timestamptz;
grant select (rappel_incomplet_le) on profiles to authenticated;

-- ------------------------------------------------------------
-- 3. ÉVÉNEMENTS INSTANTANÉS (triggers dédiés au push)
-- ------------------------------------------------------------

-- A1 — nouvelle demande d'inscription → délégués de la promo (+ admins selon
-- l'interrupteur ; toujours les admins si la promo n'a pas encore de délégué)
create or replace function push_nouvelle_demande() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  num_promo int;
  admins_ok boolean;
  a_delegue boolean;
  cibles uuid[];
begin
  select numero into num_promo from promotions where id = new.promotion_id;
  admins_ok := reglage_actif('emails_inscription_admins');
  select exists (select 1 from profiles where role = 'delegue'
                   and statut_compte = 'valide' and promotion_id = new.promotion_id)
    into a_delegue;

  select array_agg(id) into cibles from profiles
   where statut_compte = 'valide'
     and ((role = 'delegue' and promotion_id = new.promotion_id)
          or (role = 'admin' and (admins_ok or not a_delegue)));

  perform envoyer_push_liste(cibles, 'Nouvelle demande d''inscription',
    new.prenom || ' ' || new.nom || ' (promo ' || num_promo || ') attend ta validation.',
    '/admin', 'mes_demandes');
  return new;
end $$;

drop trigger if exists profiles_push_demande on profiles;
create trigger profiles_push_demande after insert on profiles
  for each row execute function push_nouvelle_demande();

-- A2 (compte validé) + B8 (suspension / réactivation) + B5-B6 (nouveau membre
-- annoncé à sa promo et à son domaine, en UNE seule notification)
create or replace function push_statut_compte() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  num_promo int;
  cibles uuid[];
begin
  if old.statut_compte = new.statut_compte then return new; end if;

  -- A2 : bienvenue
  if old.statut_compte = 'en_attente' and new.statut_compte = 'valide' then
    perform envoyer_push(new.id, 'Ton compte est validé 🎓',
      'Bienvenue parmi les tiens — l''annuaire des anciens t''est ouvert.',
      '/annuaire', 'mes_demandes');

    -- B5 + B6 : sa promo ET son domaine sont prévenus, sans doublon
    select numero into num_promo from promotions where id = new.promotion_id;
    select array_agg(distinct id) into cibles from profiles
     where statut_compte = 'valide' and id <> new.id
       and (promotion_id = new.promotion_id
            or (new.domaine is not null and domaine = new.domaine));
    perform envoyer_push_liste(cibles, 'Un nouveau membre a rejoint le réseau',
      new.prenom || ' ' || new.nom || ' (promo ' || num_promo || ') vient d''être validé·e.',
      '/profil/' || new.id, 'reseau');

  -- B8 : suspension d'un compte actif
  elsif old.statut_compte = 'valide' and new.statut_compte = 'suspendu' then
    perform envoyer_push(new.id, 'Ton compte a été suspendu',
      'Contacte les administrateurs du réseau pour en savoir plus.',
      '/a-propos', 'mes_demandes');

  -- B8 : réactivation
  elsif old.statut_compte = 'suspendu' and new.statut_compte = 'valide' then
    perform envoyer_push(new.id, 'Ton compte est réactivé',
      'Tu as de nouveau accès au réseau.', '/annuaire', 'mes_demandes');
  end if;
  -- (en_attente → suspendu = refus d'inscription : volontairement silencieux)
  return new;
end $$;

drop trigger if exists profiles_push_statut on profiles;
create trigger profiles_push_statut after update of statut_compte on profiles
  for each row execute function push_statut_compte();

-- A3 / A4 — rôle de délégué·e accordé ou retiré
create or replace function push_changement_role() returns trigger
language plpgsql security definer set search_path = public as $$
declare num_promo int;
begin
  if old.role = new.role then return new; end if;
  select numero into num_promo from promotions where id = new.promotion_id;
  if new.role = 'delegue' then
    perform envoyer_push(new.id, 'Tu es délégué·e de la promo ' || num_promo,
      'Tu peux désormais valider les inscriptions de ta promotion.',
      '/admin', 'mes_demandes');
  elsif old.role = 'delegue' and new.role = 'membre' then
    perform envoyer_push(new.id, 'Ton rôle de délégué·e a pris fin',
      'Merci pour le temps donné au réseau.', '/', 'mes_demandes');
  end if;
  return new;
end $$;

drop trigger if exists profiles_push_role on profiles;
create trigger profiles_push_role after update of role on profiles
  for each row execute function push_changement_role();

-- B9 — identité ou promotion modifiées PAR UN ADMIN (pas par soi-même)
create or replace function push_identite_modifiee() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or auth.uid() = new.id then return new; end if;
  if old.prenom = new.prenom and old.nom = new.nom
     and coalesce(old.promotion_id, -1) = coalesce(new.promotion_id, -1) then
    return new;
  end if;
  perform envoyer_push(new.id, 'Ton profil a été corrigé',
    'Un administrateur a mis à jour ton identité : ' || new.prenom || ' ' || new.nom || '.',
    '/mon-profil', 'mes_demandes');
  return new;
end $$;

drop trigger if exists profiles_push_identite on profiles;
create trigger profiles_push_identite after update of prenom, nom, promotion_id on profiles
  for each row execute function push_identite_modifiee();

-- A5 — demande de mise en relation reçue
create or replace function push_demande_contact() returns trigger
language plpgsql security definer set search_path = public as $$
declare d record;
begin
  select p.prenom, p.nom, pr.numero as promo into d
    from profiles p join promotions pr on pr.id = p.promotion_id
   where p.id = new.demandeur;
  perform envoyer_push(new.cible, d.prenom || ' ' || d.nom || ' souhaite te contacter',
    'Promo ' || d.promo || ' — tu peux accepter ou refuser.',
    '/mon-profil', 'mes_demandes');
  return new;
end $$;

drop trigger if exists demandes_contact_push on demandes_contact;
create trigger demandes_contact_push after insert on demandes_contact
  for each row execute function push_demande_contact();

-- A6 — demande acceptée (le refus reste silencieux, décision d'origine)
create or replace function push_demande_acceptee() returns trigger
language plpgsql security definer set search_path = public as $$
declare c record;
begin
  if not (old.statut = 'attente' and new.statut = 'acceptee') then return new; end if;
  select prenom, nom into c from profiles where id = new.cible;
  perform envoyer_push(new.demandeur, c.prenom || ' ' || c.nom || ' a accepté ta demande',
    'Ses coordonnées te sont maintenant ouvertes sur son profil.',
    '/profil/' || new.cible, 'mes_demandes');
  return new;
end $$;

drop trigger if exists demandes_contact_push_acceptation on demandes_contact;
create trigger demandes_contact_push_acceptation after update on demandes_contact
  for each row execute function push_demande_acceptee();

-- B1 — nouvelle offre publiée → tout le réseau sauf le posteur
create or replace function push_nouvelle_offre() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cibles uuid[];
  type_lisible text;
begin
  if new.statut <> 'active' then return new; end if;
  type_lisible := case new.type
    when 'stage' then 'Stage' when 'emploi' then 'Emploi' when 'bourse' then 'Bourse'
    when 'cooptation' then 'Cooptation' when 'concours' then 'Concours' else 'Opportunité' end;
  select array_agg(id) into cibles from profiles
   where statut_compte = 'valide' and id <> new.posteur;
  perform envoyer_push_liste(cibles, type_lisible || ' — nouvelle opportunité',
    left(new.titre, 90), '/offres#o-' || new.id, 'offres');
  return new;
end $$;

drop trigger if exists offres_push_nouvelle on offres;
create trigger offres_push_nouvelle after insert on offres
  for each row execute function push_nouvelle_offre();

-- ------------------------------------------------------------
-- 4. CRONS EXISTANTS : ajout du push (corps des emails inchangés)
-- ------------------------------------------------------------

-- A8 — relance hebdomadaire + CORRECTIF de l'interrupteur (cf. en-tête)
create or replace function relance_inscriptions_en_attente() returns void
language plpgsql security definer set search_path = public as $$
declare
  v record;
  n int;
  admins_ok boolean;
begin
  admins_ok := reglage_actif('emails_inscription_admins');
  for v in
    select d.id, u.email, d.prenom, d.role, d.promotion_id
    from profiles d
    join auth.users u on u.id = d.id
    where d.statut_compte = 'valide' and d.role in ('delegue', 'admin')
  loop
    select count(*) into n
    from profiles p
    join auth.users pu on pu.id = p.id
    where p.statut_compte = 'en_attente'
      and pu.email_confirmed_at is not null
      and p.cree_le < now() - interval '3 days'
      and (
        case
          when v.role = 'delegue' then p.promotion_id = v.promotion_id
          when admins_ok then true
          else not exists (
            select 1 from profiles dg
            where dg.role = 'delegue' and dg.statut_compte = 'valide'
              and dg.promotion_id = p.promotion_id)
        end
      );

    if n > 0 then
      perform envoyer_email(
        v.email, v.prenom,
        n || ' inscription' || case when n > 1 then 's' else '' end || ' en attente de validation',
        gabarit_email(
          'Des camarades attendent',
          'Bonjour ' || v.prenom || ', ' || n || ' demande' || case when n > 1 then 's' else '' end
          || ' d''inscription attend' || case when n > 1 then 'ent' else '' end
          || ' depuis plus de 3 jours. Un coup d''œil suffit pour valider ou refuser.',
          'Ouvrir la validation',
          'https://lsno-alumni.vercel.app/admin'));
      perform envoyer_push(v.id,
        n || ' inscription' || case when n > 1 then 's' else '' end || ' en attente',
        'Depuis plus de 3 jours — un coup d''œil suffit.', '/admin', 'mes_demandes');
    end if;
  end loop;
end $$;

-- la fonction orpheline créée par erreur en migration 27
drop function if exists relance_inscriptions();

-- A9 — demande de contact sans réponse depuis 7 jours (unique rappel)
create or replace function relance_demandes_contact() returns void
language plpgsql security definer set search_path = public as $$
declare v record;
begin
  for v in
    select dc.id, dc.cible, u.email, c.prenom as prenom_cible,
           d.prenom || ' ' || d.nom as nom_demandeur
    from demandes_contact dc
    join profiles c on c.id = dc.cible
    join auth.users u on u.id = dc.cible
    join profiles d on d.id = dc.demandeur
    where dc.statut = 'attente'
      and dc.relance_le is null
      and dc.cree_le < now() - interval '7 days'
  loop
    perform envoyer_email(
      v.email, v.prenom_cible,
      'Rappel : ' || v.nom_demandeur || ' attend ta réponse',
      gabarit_email(
        'Une demande t''attend',
        'Bonjour ' || v.prenom_cible || ', la demande de mise en relation de <b>'
        || v.nom_demandeur || '</b> est sans réponse depuis une semaine. '
        || 'Accepter ou refuser ne prend qu''un instant — en cas de refus, '
        || 'il n''en sera pas informé. (Ceci est l''unique rappel.)',
        'Répondre à la demande',
        'https://lsno-alumni.vercel.app/mon-profil'));
    perform envoyer_push(v.cible, v.nom_demandeur || ' attend ta réponse',
      'Sa demande de mise en relation date d''une semaine.', '/mon-profil', 'mes_demandes');
    update demandes_contact set relance_le = now() where id = v.id;
  end loop;
end $$;

-- A10 — offres arrivées à échéance (clôture + prévenir le posteur)
create or replace function cloture_offres_expirees() returns void
language plpgsql security definer set search_path = public as $$
declare v record;
begin
  for v in
    select o.id, o.titre, o.posteur, u.email, p.prenom
    from offres o
    join profiles p on p.id = o.posteur
    join auth.users u on u.id = o.posteur
    where o.statut = 'active'
      and (o.date_limite < current_date
           or (o.date_limite is null and o.cree_le < now() - interval '60 days'))
  loop
    update offres set statut = 'cloturee' where id = v.id;
    perform envoyer_email(
      v.email, v.prenom,
      'Ton offre « ' || left(v.titre, 40) || ' » est arrivée à échéance',
      gabarit_email(
        'Offre arrivée à échéance',
        'Bonjour ' || v.prenom || ', ton offre <b>' || v.titre || '</b> a été retirée '
        || 'automatiquement (date limite passée ou 60 jours de publication). '
        || 'Si l''opportunité est toujours ouverte, republie-la en un instant.',
        'Voir les offres',
        'https://lsno-alumni.vercel.app/offres'));
    perform envoyer_push(v.posteur, 'Ton offre est arrivée à échéance',
      left(v.titre, 80) || ' — republie-la si elle est toujours ouverte.',
      '/offres', 'mes_demandes');
  end loop;
end $$;

-- A11 — annonce au réseau : l'email part par vagues (quota Brevo), le push
-- part en une fois (aucun quota)
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
  return v_id;
end $$;

-- B9 (suite) — changement d'email de connexion par un admin
create or replace function admin_change_email(cible uuid, nouvel_email text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not est_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  nouvel_email := lower(trim(nouvel_email));
  if nouvel_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Adresse email invalide.';
  end if;
  if exists (select 1 from auth.users where lower(email) = nouvel_email and id <> cible) then
    raise exception 'Cette adresse est déjà utilisée par un autre compte.';
  end if;
  update auth.users
     set email = nouvel_email, email_confirmed_at = coalesce(email_confirmed_at, now())
   where id = cible;
  update auth.identities
     set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(nouvel_email))
   where user_id = cible and provider = 'email';
  perform envoyer_push(cible, 'Ton email de connexion a changé',
    'Nouvelle adresse : ' || nouvel_email, '/mon-profil', 'mes_demandes');
end $$;

-- ------------------------------------------------------------
-- 5. NOUVEAUX CRONS DE NOTIFICATION (push seul)
-- ------------------------------------------------------------

-- A7 — rappel annuel « profil à jour ? ». L'email s'étale sur septembre à
-- cause du quota Brevo ; le push n'a aucun quota → une seule salve le 1er.
create or replace function push_rappel_annuel() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform envoyer_push_liste(membres_valides(), 'Ton profil est-il à jour ?',
    'Un profil à jour aide les cadets et les anciens à te trouver.',
    '/mon-profil', 'mes_demandes');
end $$;
select cron.schedule('push-rappel-annuel', '0 9 1 9 *', $$select push_rappel_annuel()$$);

-- A12 — contrôle de routine des clés (le PUSH est informatif ;
-- ⚠ l'EMAIL de garde_vivant_brevo reste obligatoire : c'est lui qui maintient
--   la clé API Brevo active. Ne jamais le remplacer par du push.)
create or replace function push_controle_cles() returns void
language plpgsql security definer set search_path = public as $$
declare cibles uuid[];
begin
  select array_agg(id) into cibles from profiles
   where role = 'admin' and statut_compte = 'valide';
  perform envoyer_push_liste(cibles, 'Contrôle de routine des clés email',
    'Tout va bien — détails dans l''email que tu viens de recevoir.',
    '/admin', 'mes_demandes');
end $$;
select cron.schedule('push-controle-cles', '5 7 1 */2 *', $$select push_controle_cles()$$);

-- B13 + B14 — le 1er octobre : les sortants deviennent des anciens,
-- et une nouvelle promotion entre au lycée
create or replace function push_rentree_octobre() returns void
language plpgsql security definer set search_path = public as $$
declare
  sortants uuid[];
  nouvelle int;
begin
  -- B13 : ceux dont le bac est l'année en cours passent « anciens » ce mois-ci
  select array_agg(p.id) into sortants
    from profiles p join promotions pr on pr.id = p.promotion_id
   where p.statut_compte = 'valide'
     and pr.annee_bac = extract(year from now())::int;
  perform envoyer_push_liste(sortants, 'Te voilà parmi les anciens 🎓',
    'Choisis ton domaine et ta situation pour être trouvable par les cadets.',
    '/mon-profil', 'mes_demandes');

  -- B14 : la promotion qui vient d'ouvrir
  select max(numero) into nouvelle from promotions;
  perform envoyer_push_liste(membres_valides(), 'La promotion ' || nouvelle || ' est ouverte',
    'Une nouvelle génération entre au LSNO — le réseau s''agrandit.',
    '/annuaire', 'reseau');
end $$;
-- après ouverture-promo-octobre (6h) pour que la promo existe déjà
select cron.schedule('push-rentree-octobre', '30 6 1 10 *', $$select push_rentree_octobre()$$);

-- B10 + B11 — rappels quotidiens : profil resté incomplet, offre qui expire
create or replace function push_rappels_quotidiens() returns void
language plpgsql security definer set search_path = public as $$
declare v record;
begin
  -- B10 : 14 jours après la validation, profil très incomplet, une seule fois
  -- (valide_le peut être vide pour les tout premiers membres → repli sur cree_le)
  for v in
    select p.id
    from profiles p
    where p.statut_compte = 'valide'
      and p.rappel_incomplet_le is null
      and coalesce(p.valide_le, p.cree_le) < now() - interval '14 days'
      and (
        (case when p.statut_titre is null or p.statut_titre = '' then 0 else 1 end)
      + (case when p.ville is null or p.ville = '' then 0 else 1 end)
      + (case when p.pays is null then 0 else 1 end)
      + (case when p.conseil is null or p.conseil = '' then 0 else 1 end)
      + (case when p.photo_url is null then 0 else 1 end)
      ) <= 2   -- au plus 2 champs remplis sur 5 : profil resté très incomplet
  loop
    perform envoyer_push(v.id, 'Ton profil est encore incomplet',
      'Photo, parcours, conseil aux cadets : quelques minutes suffisent.',
      '/mon-profil', 'mes_demandes');
    update profiles set rappel_incomplet_le = now() where id = v.id;
  end loop;

  -- B11 : offre active dont la date limite tombe dans 7 jours
  for v in
    select o.posteur, o.titre
    from offres o
    where o.statut = 'active'
      and o.date_limite = current_date + 7
  loop
    perform envoyer_push(v.posteur, 'Ton offre expire dans une semaine',
      left(v.titre, 80), '/offres', 'mes_demandes');
  end loop;
end $$;
select cron.schedule('push-rappels-quotidiens', '0 9 * * *', $$select push_rappels_quotidiens()$$);

-- ------------------------------------------------------------
-- Vérification : select jobname, schedule from cron.job order by jobname;
--   → 13 jobs (9 existants + 4 nouveaux : push-rappel-annuel,
--     push-controle-cles, push-rentree-octobre, push-rappels-quotidiens)
-- ------------------------------------------------------------
