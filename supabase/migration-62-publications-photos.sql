-- ============================================================
-- Migration 62 — plusieurs photos par publication
--   Colonne photos (chemins dans le bucket « medias », jusqu'à 10) ; la
--   publication peut n'avoir que des photos. L'ancienne photo unique
--   (media_chemin / media_type = photo) reste lue telle quelle.
--   Rejouable.
-- ============================================================
alter table publications add column if not exists photos text[] not null default '{}'
  check (coalesce(array_length(photos, 1), 0) <= 10);
alter table publications drop constraint if exists publications_check;
alter table publications add constraint publications_check
  check (texte <> '' or media_chemin is not null or coalesce(array_length(photos, 1), 0) > 0);

create or replace function fil_publications(p_limite integer default 20, p_avant timestamptz default null)
returns json language sql stable security invoker set search_path = public as $$
  select coalesce(json_agg(json_build_object(
    'id', p.id,
    'texte', p.texte,
    'media_chemin', p.media_chemin,
    'media_type', p.media_type,
    'media_expire_le', p.media_expire_le,
    'photos', to_json(p.photos),
    'visibilite', p.visibilite,
    'masquee', p.masquee,
    'cree_le', p.cree_le,
    'auteur', json_build_object('id', a.id, 'prenom', a.prenom, 'nom', a.nom, 'photo_url', a.photo_url,
                                'promo', (select numero from promotions where id = a.promotion_id)),
    'mentions', (select coalesce(json_agg(json_build_object('id', m.id, 'prenom', m.prenom, 'nom', m.nom)), '[]'::json)
                   from profiles m where m.id = any(p.mentions)),
    'bravos', (select count(*) from reactions r where r.cible_type = 'publication' and r.cible_id = p.id::text),
    'commentaires', (select count(*) from commentaires c where c.cible_type = 'publication' and c.cible_id = p.id::text and not c.masque),
    'jai_bravo', exists (select 1 from reactions r where r.cible_type = 'publication' and r.cible_id = p.id::text and r.membre = auth.uid())
  ) order by p.cree_le desc), '[]'::json)
  from (
    select * from publications
    where (p_avant is null or cree_le < p_avant)
    order by cree_le desc
    limit least(coalesce(p_limite, 20), 50)
  ) p
  join profiles a on a.id = p.auteur
$$;

-- la push d'une publication sans texte dit « Des photos »
create or replace function push_publication() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_qui text; v_promo int; v_domaine text; cibles uuid[];
begin
  select prenom || ' ' || nom, promotion_id, domaine into v_qui, v_promo, v_domaine from profiles where id = new.auteur;
  select array_agg(id) into cibles from profiles
   where statut_compte = 'valide' and id <> new.auteur
     and (new.visibilite = 'tous'
          or (new.visibilite = 'promo'   and promotion_id = v_promo)
          or (new.visibilite = 'domaine' and domaine = v_domaine));
  if cibles is not null then
    perform envoyer_push_liste(cibles, v_qui || ' a publié',
      coalesce(nullif(left(new.texte, 100), ''),
               case when coalesce(array_length(new.photos, 1), 0) > 1 then array_length(new.photos, 1) || ' photos'
                    when new.media_type = 'video' then 'Une vidéo' else 'Une photo' end),
      '/publication/' || new.id, 'fil', 'pub-' || new.id);
  end if;
  return new;
end $$;

-- Vérification :
--   select column_name from information_schema.columns where table_name = 'publications' and column_name = 'photos';
