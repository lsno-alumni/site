-- ============================================================
-- Migration 02 — photos de profil (Supabase Storage)
-- À exécuter dans l'éditeur SQL après schema.sql.
-- ============================================================

-- ⚠️ LE BUCKET SE CRÉE DANS L'INTERFACE, PAS EN SQL (les versions
-- récentes de Supabase ignorent l'insert SQL dans storage.buckets) :
-- Dashboard → Storage → New bucket → name « photos » → Public bucket ✅
--
-- Bucket public : les photos sont servies par URL directe (comme
-- sur tout réseau social). L'URL contient l'UUID du membre, non
-- devinable ; la liste des fichiers n'est pas accessible au public.

-- Chacun ne peut écrire QUE son propre fichier (nommé <son-uuid>.jpg)
create policy "photos_ajout" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and name = auth.uid() || '.jpg');

create policy "photos_remplacement" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and name = auth.uid() || '.jpg');

create policy "photos_suppression" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and name = auth.uid() || '.jpg');
