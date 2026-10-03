-- ============================================================
-- Migration 77 — durée des vocaux et vidéos portée par le message
--   Un vocal enregistré dans le navigateur (webm) ne contient pas sa durée :
--   l'appli la devinait en « sautant à la fin » du fichier, ce qui donnait
--   parfois 27:58 pour 24 secondes (horodatages décalés dans le fichier) et
--   cassait la lecture. L'appli mesure maintenant la durée à l'enregistrement
--   et la range ici ; le lecteur l'affiche sans rien deviner.
--   Rejouable. Se termine par ses GRANT.
-- ============================================================
alter table messages add column if not exists fichier_duree integer
  check (fichier_duree is null or (fichier_duree >= 0 and fichier_duree <= 36000));

comment on column messages.fichier_duree is 'durée en secondes d''un vocal ou d''une vidéo, mesurée à l''envoi (null : inconnue, anciens messages)';

-- la table garde ses droits (règle : toute migration à DDL finit par ses GRANT)
grant select, insert, delete on messages to authenticated;

-- Vérification :  select column_name from information_schema.columns where table_name = 'messages' and column_name = 'fichier_duree';   -- 1 ligne
