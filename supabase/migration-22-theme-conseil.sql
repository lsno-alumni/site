-- ============================================================
-- Migration 22 — thème du conseil aux cadets
--   L'auteur range son conseil dans un thème (liste proposée OU
--   thème libre). La page /conseils regroupe par ce thème plutôt
--   que par le domaine de l'auteur (qui décrivait le métier, pas
--   le sujet du conseil). Additif ; les conseils sans thème
--   tombent dans « Général ».
-- ============================================================

alter table profiles
  add column if not exists conseil_theme text
    check (conseil_theme is null or char_length(conseil_theme) <= 40);

-- (liste fermée de colonnes depuis la migration 03 → grant explicite)
grant select (conseil_theme) on profiles to authenticated;
