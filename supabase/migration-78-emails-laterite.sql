-- ============================================================
-- Migration 78 — les emails passent à la charte « Latérite »
--   Depuis le 26/09, le site est bleu et sable (un seul accent bleu, plus
--   d'or). Les deux gabarits d'email, eux, étaient restés bleu nuit et or
--   (migrations 04 et 06). Même rendu désormais : fond papier, encre bleu-gris,
--   bouton bleu nuit. Les textes, objets et destinataires ne changent pas :
--   seules les deux fonctions de mise en forme sont redéfinies. Rejouable.
--   Pas de DDL sur une table : aucun GRANT à rétablir (fonctions appelées par
--   les déclencheurs, droits inchangés).
-- ============================================================

-- gabarit avec bouton (demandes, validation, mises en relation, rappels…)
create or replace function gabarit_email(titre text, message text, bouton text, lien text)
returns text language sql immutable as $$
  select '<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:28px 24px;background:#F4ECDC;color:#262A38;border-radius:16px;border:1px solid #D6C6A8">'
      || '<p style="font-size:11px;color:#575D6E;letter-spacing:3px;margin:0 0 14px">LSNO AMICALE</p>'
      || '<h2 style="color:#1E3A62;margin:0 0 10px;font-size:22px;line-height:1.25">' || titre || '</h2>'
      || '<p style="line-height:1.65;color:#444A5B;margin:0">' || message || '</p>'
      || '<p style="text-align:center;margin:28px 0 8px">'
      || '<a href="' || lien || '" style="display:inline-block;background:#1E3A62;color:#F6F0E4;font-weight:bold;padding:14px 28px;border-radius:100px;text-decoration:none">' || bouton || '</a></p>'
      || '<p style="font-size:11px;color:#575D6E;letter-spacing:2px;text-align:center;margin-top:24px">TRAVAIL · EXCELLENCE · DISCIPLINE</p></div>'
$$;

-- gabarit sobre (changements de rôle) : pas de gros bouton, un lien discret
create or replace function gabarit_sobre(message text, lien_texte text, lien text)
returns text language sql immutable as $$
  select '<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:20px;color:#262A38;font-size:15px;line-height:1.6">'
      || '<p style="margin:0">' || message || '</p>'
      || '<p style="margin-top:18px"><a href="' || lien || '" style="color:#1E3A62;font-weight:600">' || lien_texte || '</a></p>'
      || '<p style="margin-top:22px;color:#575D6E;font-size:13px">— LSNO Amicale, le réseau des anciens du Lycée Scientifique National de Ouagadougou</p></div>'
$$;

-- Vérification :  select gabarit_email('Titre', 'Message', 'Bouton', 'https://lsno-alumni.vercel.app') like '%#F4ECDC%';   -- true
