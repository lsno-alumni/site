-- ============================================================
-- Migration 15 — entretien automatique du réseau (4 crons)
--   ① Relance hebdo des délégués si inscriptions en attente > 3 j
--   ② Relance unique du destinataire d'une demande de contact
--      restée sans réponse 7 j
--   ③ Purge mensuelle des comptes jamais confirmés (> 30 j)
--   ④ Clôture mensuelle des offres expirées + email au posteur
--   ⑤ Email « garde-vivant » aux admins tous les 2 mois : garde la
--      clé API Brevo active (< 90 j d'inactivité) et rappelle de
--      faire vivre la clé SMTP
-- Prérequis : pg_cron (migration 13) + envoyer_email/gabarit_email
-- (migration 04). Rien à changer côté application.
-- ============================================================

-- ---------- ① inscriptions en attente oubliées ----------
-- Chaque lundi 8h UTC : si des comptes attendent depuis plus de 3 jours,
-- re-email aux délégués de la promo concernée + aux admins (filet).
-- On ignore les comptes dont l'email n'a jamais été confirmé (fantômes,
-- purgés par ③) pour ne pas relancer les délégués pour rien.
create or replace function relance_inscriptions_en_attente()
returns void language plpgsql security definer set search_path = public as $$
declare
  v record;
  n int;
begin
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
      and (v.role = 'admin' or p.promotion_id = v.promotion_id);

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
    end if;
  end loop;
end $$;

select cron.schedule('relance-inscriptions', '0 8 * * 1',
  $$select relance_inscriptions_en_attente()$$);

-- ---------- ② demandes de contact sans réponse ----------
-- Une SEULE relance, 7 jours après la demande (colonne relance_le).
alter table demandes_contact add column if not exists relance_le timestamptz;

create or replace function relance_demandes_contact()
returns void language plpgsql security definer set search_path = public as $$
declare v record;
begin
  for v in
    select dc.id, u.email, c.prenom as prenom_cible,
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
    update demandes_contact set relance_le = now() where id = v.id;
  end loop;
end $$;

select cron.schedule('relance-demandes-contact', '0 10 * * *',
  $$select relance_demandes_contact()$$);

-- ---------- ③ comptes jamais confirmés ----------
-- Le 1er du mois : supprime les comptes dont l'email n'a jamais été
-- confirmé depuis plus de 30 jours (profil supprimé en cascade).
-- Libère l'adresse pour une vraie inscription future.
create or replace function purge_comptes_non_confirmes()
returns void language plpgsql security definer
set search_path = public, auth as $$
begin
  delete from auth.users
  where email_confirmed_at is null
    and created_at < now() - interval '30 days';
end $$;

select cron.schedule('purge-comptes-fantomes', '0 5 1 * *',
  $$select purge_comptes_non_confirmes()$$);

-- ---------- ④ offres expirées ----------
-- Le 1er du mois : les offres actives dont la date limite est passée
-- (ou sans date limite et vieilles de 60 j — même règle que l'affichage)
-- passent en « cloturee », et le posteur est prévenu.
create or replace function cloture_offres_expirees()
returns void language plpgsql security definer set search_path = public as $$
declare v record;
begin
  for v in
    select o.id, o.titre, u.email, p.prenom
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
  end loop;
end $$;

select cron.schedule('cloture-offres', '30 5 1 * *',
  $$select cloture_offres_expirees()$$);

-- ---------- ⑤ garde-vivant de la clé Brevo ----------
-- Tous les 2 mois (< 90 j d'inactivité) : un email aux admins.
-- L'envoi LUI-MÊME fait vivre la clé API Brevo (celle du Vault).
-- ⚠ La clé SMTP (emails d'authentification Supabase) ne vit que par
--   les emails d'auth : l'email le rappelle, avec la manip d'1 minute.
create or replace function garde_vivant_brevo()
returns void language plpgsql security definer set search_path = public as $$
declare v record;
begin
  for v in
    select u.email, p.prenom
    from profiles p join auth.users u on u.id = p.id
    where p.role = 'admin' and p.statut_compte = 'valide'
  loop
    perform envoyer_email(
      v.email, v.prenom,
      'LSNO Amicale — contrôle de routine des clés email',
      gabarit_email(
        'Tout va bien — contrôle de routine',
        'Cet email automatique (tous les 2 mois) maintient la clé <b>API</b> Brevo active '
        || '(elle expire après 90 jours sans usage). Rien à faire pour elle : cet envoi suffit.'
        || '<br><br>La clé <b>SMTP</b> (emails de confirmation/mot de passe), elle, ne vit que '
        || 'par les emails d''authentification. Si aucune inscription récente sur le réseau : '
        || 'fais « Mot de passe oublié » sur le site avec ton adresse — l''email reçu '
        || 'fait vivre la clé SMTP. Une minute, tous les 2 mois au pire.',
        'Ouvrir le site',
        'https://lsno-alumni.vercel.app/mot-de-passe/oubli'));
  end loop;
end $$;

select cron.schedule('garde-vivant-brevo', '0 7 1 */2 *',
  $$select garde_vivant_brevo()$$);

-- ------------------------------------------------------------
-- Vérification : select jobname, schedule from cron.job order by jobname;
-- -> 7 lignes attendues : les 5 ci-dessus + rappel-annuel-profils (13)
--    + ouverture-promo-octobre (14).
-- Test manuel possible de chaque fonction :
--   select relance_inscriptions_en_attente();   -- etc.
-- ------------------------------------------------------------
