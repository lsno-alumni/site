-- ============================================================
-- Migration 78 — les emails passent à la charte « Latérite », avec le blason
--   Depuis le 26/09, le site est bleu et sable (un seul accent bleu, plus
--   d'or). Les deux gabarits d'email, eux, étaient restés bleu nuit et or
--   (migrations 04 et 06). Nouveau gabarit :
--   - fond papier, encre bleu-gris, bouton bleu nuit, titres Fraunces (repli
--     Georgia là où la police ne se charge pas) ;
--   - le blason en médaillon (image hébergée sur le site — Gmail bloque les
--     images incorporées), lisible sur fond clair comme sombre ;
--   - thème sombre déclaré (@media prefers-color-scheme + [data-ogsc]) :
--     respecté par Apple Mail, Mail iOS, Outlook mobile, Thunderbird ; Gmail
--     l'ignore et recolore lui-même — la palette le supporte ;
--   - un texte d'aperçu (préheader) caché, affiché à côté de l'objet dans les
--     listes de messages, tiré du début du message ;
--   - un pied « pourquoi cet email » avec le lien vers les réglages de
--     notifications — ce qui sépare un email d'association d'un spam.
--   Les textes, objets et destinataires ne changent pas : seules les deux
--   fonctions de mise en forme sont redéfinies. Rejouable. Pas de DDL sur une
--   table : aucun GRANT à rétablir.
-- ============================================================

-- enveloppe commune : document HTML complet, styles clair + sombre, préheader
create or replace function gabarit_enveloppe(apercu text, contenu text)
returns text language sql immutable as $$
  select '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">'
      || '<meta name="viewport" content="width=device-width, initial-scale=1">'
      || '<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">'
      || '<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500&display=swap" rel="stylesheet">'
      || '<style>'
      || 'body{margin:0;padding:24px 12px;background:#E9E0CE}'
      || '.carte{font-family:''Instrument Sans'',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px 24px;background:#F4ECDC;color:#262A38;border-radius:16px;border:1px solid #D6C6A8}'
      || '.sur{font-size:11px;letter-spacing:3px;color:#575D6E;margin:0}'
      || '.sous{font-size:12px;color:#575D6E;margin:2px 0 0}'
      || '.titre{font-family:Fraunces,Georgia,''Times New Roman'',serif;font-weight:500;color:#1E3A62;margin:22px 0 10px;font-size:24px;line-height:1.25}'
      || '.texte{line-height:1.65;color:#444A5B;margin:0;font-size:15px}'
      || '.bouton{display:inline-block;background:#1E3A62;color:#F6F0E4 !important;font-weight:bold;padding:14px 28px;border-radius:100px;text-decoration:none}'
      || '.lien{color:#1E3A62;font-weight:600}'
      || '.devise{font-size:11px;color:#575D6E;letter-spacing:2px;text-align:center;margin:24px 0 0}'
      || '.pied{font-size:12px;color:#6F7585;text-align:center;margin:18px 0 0;line-height:1.5}'
      || '.pied a{color:#6F7585}'
      || '.medaillon{width:52px;height:52px;vertical-align:middle}'
      || '@media (prefers-color-scheme: dark){'
      || 'body{background:#141A26 !important}'
      || '.carte{background:#1C2535 !important;color:#F6F0E4 !important;border-color:#2A3650 !important}'
      || '.titre{color:#8FBBFF !important}.texte{color:#C9CFDB !important}'
      || '.sur,.sous,.devise{color:#9AA3B5 !important}.pied,.pied a{color:#7F8899 !important}'
      || '.bouton{background:#3B6FD1 !important;color:#FFFFFF !important}.lien{color:#8FBBFF !important}'
      || '}'
      || '[data-ogsc] body{background:#141A26 !important}[data-ogsc] .carte{background:#1C2535 !important;color:#F6F0E4 !important}'
      || '[data-ogsc] .titre{color:#8FBBFF !important}[data-ogsc] .texte{color:#C9CFDB !important}[data-ogsc] .bouton{background:#3B6FD1 !important}'
      || '</style></head><body>'
      -- texte d'aperçu invisible (listes de messages) puis bourrage pour que l'aperçu ne continue pas sur le corps
      || '<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#E9E0CE">' || apercu
      || repeat('&#847;&zwnj;&nbsp;', 40) || '</div>'
      || '<div class="carte">'
      || '<table cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse"><tr>'
      || '<td class="medaillon"><img src="https://lsno-alumni.vercel.app/img/logo-email.png" width="52" height="52" alt="LSNO" style="display:block;border-radius:50%"></td>'
      || '<td style="padding-left:12px;vertical-align:middle"><p class="sur">LSNO AMICALE</p><p class="sous">Le réseau des anciens</p></td>'
      || '</tr></table>'
      || contenu
      || '<p class="devise">TRAVAIL · EXCELLENCE · DISCIPLINE</p>'
      || '<p class="pied">Tu reçois cet email parce que tu es membre de LSNO Amicale.<br>'
      || '<a href="https://lsno-alumni.vercel.app/mon-profil">Régler mes notifications</a> · <a href="https://lsno-alumni.vercel.app">lsno-alumni.vercel.app</a></p>'
      || '</div></body></html>'
$$;

-- le début du message, sans balises, pour le texte d'aperçu
create or replace function gabarit_apercu(message text)
returns text language sql immutable as $$
  select left(regexp_replace(regexp_replace(coalesce(message, ''), '<[^>]+>', '', 'g'), '\s+', ' ', 'g'), 110)
$$;

-- gabarit avec bouton (demandes, validation, mises en relation, rappels…)
create or replace function gabarit_email(titre text, message text, bouton text, lien text)
returns text language sql immutable as $$
  select gabarit_enveloppe(
    gabarit_apercu(message),
       '<h2 class="titre">' || titre || '</h2>'
    || '<p class="texte">' || message || '</p>'
    || '<p style="text-align:center;margin:28px 0 8px"><a class="bouton" href="' || lien || '">' || bouton || '</a></p>'
  )
$$;

-- gabarit sobre (changements de rôle) : pas de gros bouton, un lien discret
create or replace function gabarit_sobre(message text, lien_texte text, lien text)
returns text language sql immutable as $$
  select gabarit_enveloppe(
    gabarit_apercu(message),
       '<p class="texte" style="margin-top:22px">' || message || '</p>'
    || '<p style="margin-top:18px"><a class="lien" href="' || lien || '">' || lien_texte || '</a></p>'
  )
$$;

-- fonctions internes : appelées par les déclencheurs, pas depuis l'appli
revoke all on function gabarit_enveloppe(text, text) from public, anon, authenticated;
revoke all on function gabarit_apercu(text) from public, anon, authenticated;

-- Vérification :  select gabarit_email('Titre', 'Message <b>gras</b>', 'Bouton', 'https://lsno-alumni.vercel.app') like '%logo-email.png%';   -- true
