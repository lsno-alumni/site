-- ============================================================
-- Migration 25 — PIÈCES JOINTES DES OFFRES (ressources)
--   Le posteur d'une offre peut y joindre des fichiers (PDF, images),
--   téléchargeables par les membres validés. Optionnel.
--   5 fichiers max / offre, 10 Mo chacun (contrôlé côté client).
-- ============================================================

-- ⚠️ 1) LE BUCKET SE CRÉE DANS L'INTERFACE (pas en SQL) :
--    Dashboard → Storage → New bucket → name « ressources » → Public bucket ✅
--    (public comme « photos » : servi par URL directe, chemin en UUID non
--     devinable ; les offres sont de toute façon derrière la connexion)

-- 2) Table des fichiers joints (métadonnées ; le binaire est dans le Storage)
create table offre_fichiers (
  id        bigserial primary key,
  offre_id  bigint not null references offres(id) on delete cascade,
  chemin    text not null,          -- chemin dans le bucket « ressources »
  nom       text not null,          -- nom d'affichage (nom d'origine du fichier)
  type      text,                   -- type MIME
  taille    integer,                -- octets
  cree_le   timestamptz not null default now()
);
create index offre_fichiers_offre_idx on offre_fichiers(offre_id);

grant select, insert, delete on offre_fichiers to authenticated;
grant usage, select on sequence offre_fichiers_id_seq to authenticated;

alter table offre_fichiers enable row level security;

-- lecture : membres validés (comme les offres)
create policy offre_fichiers_lecture on offre_fichiers
  for select to authenticated
  using ((select statut_compte from profiles where id = auth.uid()) = 'valide');

-- ajout : uniquement par le posteur de l'offre parente (compte validé)
create policy offre_fichiers_insertion on offre_fichiers
  for insert to authenticated
  with check (
    (select statut_compte from profiles where id = auth.uid()) = 'valide'
    and exists (select 1 from offres o where o.id = offre_id and o.posteur = auth.uid())
  );

-- suppression : le posteur de l'offre, ou un admin (modération)
create policy offre_fichiers_suppression on offre_fichiers
  for delete to authenticated
  using (
    exists (select 1 from offres o where o.id = offre_id and o.posteur = auth.uid())
    or (select role from profiles where id = auth.uid()) = 'admin'
  );

-- 3) Politiques de stockage sur le bucket « ressources »
--    chemin des objets : « <uuid-posteur>/<id-offre>/<horodatage>-<nom> »

-- lecture (nécessaire aussi pour la relecture juste après l'upload)
create policy "ressources_lecture" on storage.objects
  for select to authenticated
  using (bucket_id = 'ressources');

-- ajout : chacun n'écrit que sous SON dossier (1er segment = son uuid)
create policy "ressources_ajout" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ressources'
    and split_part(name, '/', 1) = auth.uid()::text
    and (select statut_compte from profiles where id = auth.uid()) = 'valide'
  );

-- suppression : le propriétaire du dossier, ou un admin
create policy "ressources_suppression" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'ressources'
    and (
      split_part(name, '/', 1) = auth.uid()::text
      or (select role from profiles where id = auth.uid()) = 'admin'
    )
  );
