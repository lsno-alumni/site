-- ============================================================
-- Migration 16 — retours pilote : « Mon histoire » + sujets cadets
--   ① histoire : récit libre optionnel sur le profil (≤ 2000 car.)
--   ② sujets_cadets : sujets sur lesquels le membre veut bien
--      échanger avec les cadets (pastilles proposées + libres,
--      8 max, affichées si « Répond aux cadets » est actif)
-- Additive, aucun impact sur l'existant.
-- ============================================================

alter table profiles
  add column if not exists histoire text
    check (histoire is null or char_length(histoire) <= 2000);

alter table profiles
  add column if not exists sujets_cadets text[] not null default '{}'
    check (coalesce(array_length(sujets_cadets, 1), 0) <= 8);

-- ⚠ la migration 03 a remplacé le SELECT global sur profiles par une
-- liste fermée de colonnes : toute nouvelle colonne doit être ajoutée
-- explicitement, sinon elle est invisible pour l'application.
grant select (histoire, sujets_cadets) on profiles to authenticated;

-- Vérification (facultatif) :
--   select histoire, sujets_cadets from profiles where id = auth.uid();
