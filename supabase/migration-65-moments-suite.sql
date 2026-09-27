-- ============================================================
-- Migration 65 — Moments, suite
--   Réactions rapides (un emoji par personne et par moment, remplaçable),
--   mentions « @Prénom Nom » dans la légende avec notification, et le rail
--   qui renvoie les deux. Rejouable.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Mentions dans la légende
-- ------------------------------------------------------------
alter table moments add column if not exists mentions uuid[] not null default '{}';

create or replace function push_mentions_moment() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_qui text; v_promo int; v_domaine text; cibles uuid[];
begin
  if new.mentions is null or array_length(new.mentions, 1) is null then return new; end if;
  select prenom || ' ' || nom, promotion_id, domaine into v_qui, v_promo, v_domaine from profiles where id = new.auteur;
  -- seulement ceux qui ont le droit de le voir (cercle de visibilité)
  select array_agg(p.id) into cibles from profiles p
   where p.id = any(new.mentions) and p.id <> new.auteur and p.statut_compte = 'valide'
     and (new.visibilite = 'tous'
          or (new.visibilite = 'promo'   and p.promotion_id = v_promo)
          or (new.visibilite = 'domaine' and p.domaine = v_domaine));
  if cibles is not null then
    perform envoyer_push_liste(cibles, v_qui || ' t''a mentionné dans un moment', left(new.legende, 100),
      '/fil?moment=' || new.id, 'mes_demandes', 'mention-moments-' || new.id);
  end if;
  return new;
end $$;
drop trigger if exists moments_push_mentions on moments;
create trigger moments_push_mentions after insert on moments
  for each row execute function push_mentions_moment();

-- ------------------------------------------------------------
-- 2. Réactions rapides
-- ------------------------------------------------------------
create table if not exists moment_reactions (
  moment_id  bigint not null references moments(id) on delete cascade,
  membre     uuid not null references profiles(id) on delete cascade,
  emoji      text not null check (char_length(emoji) between 1 and 8),
  cree_le    timestamptz not null default now(),
  primary key (moment_id, membre)
);
grant select, insert, update, delete on moment_reactions to authenticated;
alter table moment_reactions enable row level security;

-- chacun voit sa réaction ; l'auteur du moment voit toutes celles de son moment
drop policy if exists moment_reactions_lecture on moment_reactions;
create policy moment_reactions_lecture on moment_reactions
  for select to authenticated
  using (membre = auth.uid() or exists (select 1 from moments m where m.id = moment_id and m.auteur = auth.uid()));
drop policy if exists moment_reactions_ecriture on moment_reactions;
create policy moment_reactions_ecriture on moment_reactions
  for insert to authenticated
  with check (mon_statut() = 'valide' and membre = auth.uid()
              and exists (select 1 from moments m where m.id = moment_id));   -- passe par la lecture (cercle, expiration)
drop policy if exists moment_reactions_modification on moment_reactions;
create policy moment_reactions_modification on moment_reactions
  for update to authenticated using (membre = auth.uid()) with check (membre = auth.uid());
drop policy if exists moment_reactions_suppression on moment_reactions;
create policy moment_reactions_suppression on moment_reactions
  for delete to authenticated using (membre = auth.uid());

-- l'auteur est prévenu (une notification par personne, remplacée si elle change d'emoji)
create or replace function push_reaction_moment() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_auteur uuid; v_legende text; v_qui text;
begin
  select auteur, coalesce(nullif(legende, ''), '') into v_auteur, v_legende from moments where id = new.moment_id;
  if v_auteur is null or v_auteur = new.membre then return new; end if;
  select prenom || ' ' || nom into v_qui from profiles where id = new.membre;
  perform envoyer_push_liste(array[v_auteur], v_qui || ' a réagi ' || new.emoji || ' à ton moment', v_legende,
    '/fil?moment=' || new.moment_id, 'mes_demandes', 'reaction-moment-' || new.moment_id || '-' || new.membre);
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists moment_reactions_push on moment_reactions;
create trigger moment_reactions_push after insert or update of emoji on moment_reactions
  for each row execute function push_reaction_moment();

-- ------------------------------------------------------------
-- 3. Le rail renvoie mentions et réactions
--    (réactions : l'auteur voit les comptes par emoji, les autres seulement
--    la leur — c'est la politique de lecture qui filtre)
-- ------------------------------------------------------------
create or replace function rail_moments() returns json
language sql stable security invoker set search_path = public as $$
  with visibles as (
    select m.* from moments m where m.expire_le > now()
  ),
  par_auteur as (
    select a.id as auteur_id,
           json_build_object('id', a.id, 'prenom', a.prenom, 'nom', a.nom, 'photo_url', a.photo_url,
                             'promo', (select numero from promotions where id = a.promotion_id)) as auteur,
           max(m.cree_le) as dernier,
           bool_and(exists (select 1 from moment_vues v where v.moment_id = m.id and v.membre = auth.uid())) as tout_vu,
           json_agg(json_build_object(
             'id', m.id, 'media_chemin', m.media_chemin, 'media_type', m.media_type, 'legende', m.legende,
             'visibilite', m.visibilite, 'masque', m.masque, 'cree_le', m.cree_le, 'expire_le', m.expire_le,
             'vu', exists (select 1 from moment_vues v where v.moment_id = m.id and v.membre = auth.uid()),
             'vues', case when m.auteur = auth.uid() then (select count(*) from moment_vues v where v.moment_id = m.id) end,
             'mentions', (select coalesce(json_agg(json_build_object('id', p.id, 'prenom', p.prenom, 'nom', p.nom)), '[]'::json)
                            from profiles p where p.id = any(m.mentions)),
             'reactions', (select coalesce(json_object_agg(r.emoji, r.n), '{}'::json)
                             from (select emoji, count(*) as n from moment_reactions where moment_id = m.id group by emoji) r),
             'ma_reaction', (select emoji from moment_reactions r where r.moment_id = m.id and r.membre = auth.uid())
           ) order by m.cree_le) as moments
      from visibles m join profiles a on a.id = m.auteur
     group by a.id, a.prenom, a.nom, a.photo_url, a.promotion_id
  )
  select coalesce(json_agg(json_build_object('auteur', auteur, 'tout_vu', tout_vu, 'moments', moments)
           order by (auteur_id = auth.uid()) desc, tout_vu asc, dernier desc), '[]'::json)
    from par_auteur
$$;

-- la purge retire aussi les réactions (cascade) : rien à changer.

-- Vérifications :
--   select count(*) from pg_policies where tablename = 'moment_reactions';   -- 4
--   select column_name from information_schema.columns where table_name = 'moments' and column_name = 'mentions';
