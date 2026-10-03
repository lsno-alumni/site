-- ============================================================
-- Migration 80 — le carrousel d'À propos : deux photos par promotion,
--                 tenues par ses délégués, avec un titre
--   Les photos du lycée restent dans le code (avec leurs titres). Chaque
--   promotion peut y ajouter deux photos (emplacements 1 et 2), classées après
--   celles du lycée dans l'ordre des promotions. Les délégués de la promo (et
--   les admins) ajoutent, remplacent, retitrent, retirent. Les quatre photos de
--   promos déjà présentes sont rattachées à leurs promotions (1, 2, 3 et 5) :
--   leurs délégués peuvent les changer.
--
--   Conformité au contrôle de santé (migration 75) : AUCUN droit de table pour
--   anon/authenticated (lecture et écriture passent par trois fonctions
--   « security definer » inscrites dans la liste blanche), RLS activée avec une
--   politique, clé composée sans séquence. Fichiers dans le bucket public
--   « medias », dossier carrousel/promo-<id>/<emplacement>.jpg (écrasé au
--   remplacement : pas de fichier orphelin). Chaque écriture va au journal.
--   Rejouable. Se termine par ses GRANT (aucun sur la table : c'est voulu).
-- ============================================================
create table if not exists carrousel_photos (
  promotion_id int  not null references promotions(id) on delete cascade,
  position     smallint not null check (position in (1, 2)),
  chemin       text not null check (chemin like 'carrousel/%' or chemin like '/img/%'),
  titre        text not null check (char_length(btrim(titre)) between 1 and 60),
  ajoute_par   uuid,                       -- sans référence : survit à la suppression du compte
  maj_le       timestamptz not null default now(),
  primary key (promotion_id, position)
);
comment on table carrousel_photos is 'Photos de promotion du carrousel d''À propos (2 par promo), tenues par les délégués ; lecture et écriture par carrousel_liste / carrousel_enregistrer / carrousel_retirer';
alter table carrousel_photos enable row level security;
drop policy if exists "carrousel_lecture_interne" on carrousel_photos;
create policy "carrousel_lecture_interne" on carrousel_photos for select to authenticated using (true);
revoke all on carrousel_photos from public, anon, authenticated;

-- qui peut tenir les photos d'une promotion : ses délégués (compte validé) et les admins
create or replace function peut_gerer_carrousel(p_promotion int) returns boolean
language sql stable security invoker set search_path = public as $$
  select est_admin() or exists (
    select 1 from profiles p
     where p.id = auth.uid() and p.role = 'delegue' and p.statut_compte = 'valide' and p.promotion_id = p_promotion)
$$;
grant execute on function peut_gerer_carrousel(int) to authenticated;

-- la liste pour la page (publique) et pour l'espace délégué : les promotions et leurs photos
create or replace function carrousel_liste() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'promotions', (select coalesce(json_agg(json_build_object('id', id, 'numero', numero, 'annee_bac', annee_bac) order by numero), '[]'::json) from promotions),
    'photos', (select coalesce(json_agg(json_build_object(
                 'promotion_id', c.promotion_id, 'numero', pr.numero, 'annee_bac', pr.annee_bac, 'position', c.position,
                 'chemin', c.chemin, 'titre', c.titre, 'maj_le', c.maj_le) order by pr.numero, c.position), '[]'::json)
               from carrousel_photos c join promotions pr on pr.id = c.promotion_id)
  )
$$;
revoke all on function carrousel_liste() from public;
grant execute on function carrousel_liste() to anon, authenticated;

-- ajouter, remplacer ou retitrer une photo
create or replace function carrousel_enregistrer(p_promotion int, p_position int, p_chemin text, p_titre text) returns void
language plpgsql security definer set search_path = public as $$
declare v_numero int;
begin
  if not peut_gerer_carrousel(p_promotion) then raise exception 'Réservé aux délégués de cette promotion et aux administrateurs.'; end if;
  if p_position not in (1, 2) then raise exception 'Emplacement inconnu.'; end if;
  if char_length(btrim(coalesce(p_titre, ''))) not between 1 and 60 then raise exception 'Le titre fait de 1 à 60 caractères.'; end if;
  if p_chemin not like 'carrousel/promo-' || p_promotion || '/%' and p_chemin not like '/img/%' then raise exception 'Chemin de fichier inattendu.'; end if;
  insert into carrousel_photos (promotion_id, position, chemin, titre, ajoute_par, maj_le)
  values (p_promotion, p_position, p_chemin, btrim(p_titre), auth.uid(), now())
  on conflict (promotion_id, position) do update
    set chemin = excluded.chemin, titre = excluded.titre, ajoute_par = excluded.ajoute_par, maj_le = now();
  select numero into v_numero from promotions where id = p_promotion;
  perform journaliser('carrousel', null, jsonb_build_object('promo', v_numero, 'position', p_position, 'titre', btrim(p_titre), 'action', 'enregistre'));
end $$;
revoke all on function carrousel_enregistrer(int, int, text, text) from public, anon;
grant execute on function carrousel_enregistrer(int, int, text, text) to authenticated;

-- retirer une photo (et son fichier s'il est dans le stockage)
create or replace function carrousel_retirer(p_promotion int, p_position int) returns void
language plpgsql security definer set search_path = public as $$
declare v_chemin text; v_titre text; v_numero int;
begin
  if not peut_gerer_carrousel(p_promotion) then raise exception 'Réservé aux délégués de cette promotion et aux administrateurs.'; end if;
  select chemin, titre into v_chemin, v_titre from carrousel_photos where promotion_id = p_promotion and position = p_position;
  if v_chemin is null then return; end if;
  delete from carrousel_photos where promotion_id = p_promotion and position = p_position;
  if v_chemin like 'carrousel/%' then delete from storage.objects where bucket_id = 'medias' and name = v_chemin; end if;
  select numero into v_numero from promotions where id = p_promotion;
  perform journaliser('carrousel', null, jsonb_build_object('promo', v_numero, 'position', p_position, 'titre', v_titre, 'action', 'retrait'));
end $$;
revoke all on function carrousel_retirer(int, int) from public, anon;
grant execute on function carrousel_retirer(int, int) to authenticated;

insert into sante_fonctions_ouvertes (nom, raison) values
  ('carrousel_liste', 'carrousel d''À propos : la liste des photos de promotions (page publique)'),
  ('carrousel_enregistrer', 'carrousel d''À propos : un délégué ajoute, remplace ou retitre une photo de sa promo'),
  ('carrousel_retirer', 'carrousel d''À propos : un délégué retire une photo de sa promo')
on conflict (nom) do nothing;

-- le stockage : dossier carrousel/promo-<id>/ du bucket public « medias », tenu par les délégués de la promo
drop policy if exists "carrousel_ajout" on storage.objects;
create policy "carrousel_ajout" on storage.objects for insert to authenticated
  with check (bucket_id = 'medias' and name ~ '^carrousel/promo-[0-9]+/[12]\.jpg$'
    and peut_gerer_carrousel((regexp_match(name, '^carrousel/promo-([0-9]+)/'))[1]::int));
drop policy if exists "carrousel_maj" on storage.objects;
create policy "carrousel_maj" on storage.objects for update to authenticated
  using (bucket_id = 'medias' and name ~ '^carrousel/promo-[0-9]+/[12]\.jpg$'
    and peut_gerer_carrousel((regexp_match(name, '^carrousel/promo-([0-9]+)/'))[1]::int));
drop policy if exists "carrousel_retrait" on storage.objects;
create policy "carrousel_retrait" on storage.objects for delete to authenticated
  using (bucket_id = 'medias' and name ~ '^carrousel/promo-[0-9]+/[12]\.jpg$'
    and peut_gerer_carrousel((regexp_match(name, '^carrousel/promo-([0-9]+)/'))[1]::int));

-- les quatre photos de promos déjà dans le carrousel, rattachées à leurs promotions
insert into carrousel_photos (promotion_id, position, chemin, titre)
select p.id, 1, v.chemin, v.titre
  from (values (1, '/img/lsno_promo1.jpg', 'Promo 1'), (2, '/img/lsno_promo2.jpg', 'Promo 2'),
               (3, '/img/lsno_promo3.jpg', 'Promo 3'), (5, '/img/lsno_groupe.jpg', 'Promo 5 avec le proviseur')) as v(numero, chemin, titre)
  join promotions p on p.numero = v.numero
on conflict (promotion_id, position) do nothing;

-- Vérification :  select json_array_length(carrousel_liste()->'photos');   -- 4 (ou plus)
