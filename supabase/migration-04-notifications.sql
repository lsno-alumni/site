-- ============================================================
-- Migration 04 — notifications email automatiques
--   1) Nouvelle inscription  -> email aux délégués de la promo + admins
--   2) Compte validé         -> email au membre concerné
-- Envoi via l'API Brevo, déclenché par la base elle-même (pg_net).
--
-- ⚠ AVANT D'EXÉCUTER : remplacer COLLE_TA_CLE_API_BREVO_ICI ci-dessous
--   par une clé API Brevo (Brevo -> Settings -> SMTP & API -> onglet
--   API Keys -> Generate a new API key). C'est une clé DIFFÉRENTE de
--   la clé SMTP.
-- ============================================================

create extension if not exists pg_net;

-- la clé est rangée dans le coffre chiffré de Supabase (Vault),
-- jamais lisible par les clients de l'API
select vault.create_secret('COLLE_TA_CLE_API_BREVO_ICI', 'brevo_api_key');

-- ---------- envoi générique (ne bloque JAMAIS l'action d'origine) ----------
create or replace function envoyer_email(dest text, dest_nom text, sujet text, corps_html text)
returns void language plpgsql security definer set search_path = public as $$
declare cle text;
begin
  select decrypted_secret into cle from vault.decrypted_secrets where name = 'brevo_api_key';
  if cle is null or dest is null then return; end if;
  perform net.http_post(
    url     := 'https://api.brevo.com/v3/smtp/email',
    headers := jsonb_build_object('api-key', cle, 'Content-Type', 'application/json'),
    body    := jsonb_build_object(
      'sender',      jsonb_build_object('name', 'LSNO Amicale', 'email', 'lsno.alumni@gmail.com'),
      'to',          jsonb_build_array(jsonb_build_object('email', dest, 'name', coalesce(dest_nom, dest))),
      'subject',     sujet,
      'htmlContent', corps_html));
exception when others then
  null;  -- un échec d'email ne doit jamais faire échouer l'inscription/validation
end $$;

-- ---------- gabarit maison (mêmes couleurs que le site) ----------
create or replace function gabarit_email(titre text, message text, bouton text, lien text)
returns text language sql immutable as $$
  select '<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#0A1B33;color:#F5F1E8;border-radius:16px">'
      || '<h2 style="color:#F5CD6E;margin:0 0 6px">' || titre || '</h2>'
      || '<p style="line-height:1.6;color:#E4DCCB">' || message || '</p>'
      || '<p style="text-align:center;margin:28px 0">'
      || '<a href="' || lien || '" style="background:#E8B33C;color:#0A1B33;font-weight:bold;padding:14px 28px;border-radius:100px;text-decoration:none">' || bouton || '</a></p>'
      || '<p style="font-size:11px;color:#93A5C0;letter-spacing:2px;text-align:center;margin-top:24px">TRAVAIL · EXCELLENCE · DISCIPLINE</p></div>'
$$;

-- ---------- 1) nouvelle inscription -> délégués de la promo + admins ----------
create or replace function notifie_nouvelle_demande() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v record;
  num_promo int;
begin
  select numero into num_promo from promotions where id = new.promotion_id;
  for v in
    select u.email, p.prenom
    from profiles p
    join auth.users u on u.id = p.id
    where p.statut_compte = 'valide'
      and (p.role = 'admin' or (p.role = 'delegue' and p.promotion_id = new.promotion_id))
  loop
    perform envoyer_email(
      v.email, v.prenom,
      'Nouvelle demande : ' || new.prenom || ' ' || new.nom || ' (Promo ' || num_promo || ')',
      gabarit_email(
        'Nouvelle demande d''inscription',
        '<b>' || new.prenom || ' ' || new.nom || '</b> se déclare de la promotion ' || num_promo ||
        ' et attend ta validation.',
        'Valider ou refuser',
        'https://lsno-alumni.vercel.app/admin'));
  end loop;
  return new;
end $$;

create trigger profiles_notifie_demande
  after insert on profiles
  for each row execute function notifie_nouvelle_demande();

-- ---------- 2) compte validé -> le membre concerné ----------
create or replace function notifie_validation() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if old.statut_compte = 'en_attente' and new.statut_compte = 'valide' then
    select email into v_email from auth.users where id = new.id;
    perform envoyer_email(
      v_email, new.prenom,
      'Ton compte est validé — bienvenue ! 🎉',
      gabarit_email(
        'Bienvenue parmi les tiens 🎓',
        'Un délégué de ta promotion vient de valider ton compte, ' || new.prenom ||
        '. L''annuaire des anciens t''est ouvert — et pense à compléter ton profil '
        || '(photo, parcours, conseil aux cadets) pour être facile à trouver.',
        'Découvrir l''annuaire',
        'https://lsno-alumni.vercel.app/annuaire'));
  end if;
  return new;
end $$;

create trigger profiles_notifie_validation
  after update on profiles
  for each row execute function notifie_validation();
