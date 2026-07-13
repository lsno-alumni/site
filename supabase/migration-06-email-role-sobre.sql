-- ============================================================
-- Migration 06 — email de PROMOTION délégué plus « personnel »
-- Objectif : éviter l'onglet « Promotions » de Gmail (qui coupe les
-- notifications). On retire les signaux marketing (mot « promotion »
-- dans l'objet, emoji, ton festif, gros bouton doré) au profit d'un
-- message sobre avec un simple lien texte.
-- Réutilise envoyer_email() de la migration 04.
-- ============================================================

-- gabarit sobre : pas de gros bouton, un lien texte discret, ton neutre
create or replace function gabarit_sobre(message text, lien_texte text, lien text)
returns text language sql immutable as $$
  select '<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:20px;color:#1a1a1a;font-size:15px;line-height:1.6">'
      || '<p>' || message || '</p>'
      || '<p style="margin-top:18px"><a href="' || lien || '" style="color:#1B4A9C">' || lien_texte || '</a></p>'
      || '<p style="margin-top:22px;color:#888;font-size:13px">— LSNO Amicale, le réseau des anciens du Lycée Scientifique National de Ouagadougou</p></div>'
$$;

create or replace function notifie_changement_role() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  num_promo int;
begin
  if old.role is not distinct from new.role then
    return new;
  end if;
  select email into v_email from auth.users where id = new.id;
  select numero into num_promo from promotions where id = new.promotion_id;

  if old.role = 'membre' and new.role = 'delegue' then
    -- objet sobre, sans emoji ni le mot « promotion » en tête
    perform envoyer_email(
      v_email, new.prenom,
      'Ton nouveau rôle sur LSNO Amicale',
      gabarit_sobre(
        'Bonjour ' || new.prenom || ',<br><br>Tu es désormais délégué·e de ta promotion (promo '
        || num_promo || ') sur LSNO Amicale. Concrètement, tu valides les demandes '
        || 'd''inscription de tes camarades de promo : tu reçois un message à chaque '
        || 'nouvelle demande, et tu valides ou refuses en un geste depuis l''onglet Validation. '
        || 'C''est toi qui gardes la porte du réseau pour ta promo.',
        'Ouvrir l''onglet Validation',
        'https://lsno-alumni.vercel.app/admin'));

  elsif old.role = 'delegue' and new.role = 'membre' then
    perform envoyer_email(
      v_email, new.prenom,
      'Fin de ton rôle de délégué sur LSNO Amicale',
      gabarit_sobre(
        'Bonjour ' || new.prenom || ',<br><br>Ton rôle de délégué·e de la promo ' || num_promo ||
        ' a pris fin — merci d''avoir gardé la porte du réseau. Ton profil et ton accès '
        || 'de membre restent inchangés.',
        'Retour à l''annuaire',
        'https://lsno-alumni.vercel.app/annuaire'));
  end if;
  return new;
end $$;
