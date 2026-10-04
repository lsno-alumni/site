-- ============================================================
-- Migration 55 — réactions libres sur les messages
--   Le bouton « + » du menu d'une bulle ouvre une grille d'emoji : la base
--   n'impose plus la liste des six, seulement une longueur raisonnable.
--   Rejouable.
-- ============================================================
alter table message_reactions drop constraint if exists message_reactions_emoji_check;
alter table message_reactions add constraint message_reactions_emoji_check
  check (char_length(emoji) between 1 and 16);

-- Vérification :
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'message_reactions_emoji_check';
