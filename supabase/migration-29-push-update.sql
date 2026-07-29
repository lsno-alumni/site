-- ============================================================
-- Migration 29 — correctif du socle push
--   L'enregistrement d'un appareil se fait en « upsert » (insert … on
--   conflict (endpoint) do update) : réactiver les notifications sur un
--   appareil déjà connu doit rafraîchir ses clés au lieu d'échouer.
--   Or l'upsert exige le privilège UPDATE, absent de la migration 28
--   → « permission denied for table push_abonnements ».
-- ============================================================

grant update on push_abonnements to authenticated;

-- chacun ne met à jour que ses propres appareils
create policy push_abo_maj on push_abonnements
  for update to authenticated
  using (profil = auth.uid())
  with check (profil = auth.uid());
