-- ============================================================
-- Migration 68 — Groupes qu'on peut rejoindre
--   Un groupe a un accès : privé (l'actuel, sur invitation), sur demande
--   (visible dans l'annuaire des groupes, le créateur accepte ou refuse),
--   ouvert (visible, on entre d'un tap). Cercle de visibilité comme partout.
--   Les groupes existants restent privés. Un groupe créé par un délégué ou
--   un admin porte la marque « Amicale ». Rejouable.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Colonnes et table des demandes
-- ------------------------------------------------------------
alter table conversations add column if not exists acces text not null default 'prive' check (acces in ('prive', 'demande', 'ouvert'));
alter table conversations add column if not exists visibilite text not null default 'tous' check (visibilite in ('tous', 'promo', 'domaine'));
alter table conversations add column if not exists officiel boolean not null default false;

create or replace function conversations_avant_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.type = 'groupe' and new.cree_par is not null then
    new.officiel := coalesce((select role in ('delegue', 'admin') from profiles where id = new.cree_par), false);
  end if;
  return new;
end $$;
drop trigger if exists conversations_avant_insert on conversations;
create trigger conversations_avant_insert before insert on conversations
  for each row execute function conversations_avant_insert();

create table if not exists groupe_demandes (
  conversation_id bigint not null references conversations(id) on delete cascade,
  membre          uuid not null references profiles(id) on delete cascade,
  statut          text not null default 'en_attente' check (statut in ('en_attente', 'refusee')),
  cree_le         timestamptz not null default now(),
  traite_le       timestamptz,
  traite_par      uuid references profiles(id),
  primary key (conversation_id, membre)
);
grant select on groupe_demandes to authenticated;   -- écriture par les fonctions seulement
alter table groupe_demandes enable row level security;
drop policy if exists groupe_demandes_lecture on groupe_demandes;
create policy groupe_demandes_lecture on groupe_demandes
  for select to authenticated
  using (membre = auth.uid() or anime_le_groupe(conversation_id) or est_moderateur());

-- ------------------------------------------------------------
-- 2. Lecture : l'annuaire des groupes (ceux qu'on peut rejoindre)
--    Definer : la politique de lecture des conversations ne montre que
--    celles dont on est membre ; ici on ne renvoie que le strict nécessaire.
-- ------------------------------------------------------------
create or replace function groupe_visible(c conversations) returns boolean
language sql stable security definer set search_path = public as $$
  select c.type = 'groupe' and c.acces <> 'prive' and c.cree_par is not null
     and dans_le_cercle(c.cree_par, c.visibilite)
$$;
revoke all on function groupe_visible(conversations) from public, anon, authenticated;

create or replace function groupes_visibles(p_q text default null) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
    'id', c.id, 'nom', c.nom, 'photo_url', c.photo_url, 'description', c.description,
    'acces', c.acces, 'visibilite', c.visibilite, 'officiel', c.officiel, 'cree_le', c.cree_le,
    'nb_membres', (select count(*) from conversation_membres m where m.conversation_id = c.id),
    'createur', (select json_build_object('id', p.id, 'prenom', p.prenom, 'nom', p.nom) from profiles p where p.id = c.cree_par),
    'ma_demande', (select d.statut from groupe_demandes d where d.conversation_id = c.id and d.membre = auth.uid()),
    'refusee_le', (select d.traite_le from groupe_demandes d where d.conversation_id = c.id and d.membre = auth.uid() and d.statut = 'refusee')
  ) order by c.officiel desc, (select count(*) from conversation_membres m where m.conversation_id = c.id) desc, c.cree_le desc), '[]'::json)
  from conversations c
  where mon_statut() = 'valide'
    and groupe_visible(c)
    and not exists (select 1 from conversation_membres m where m.conversation_id = c.id and m.membre = auth.uid())
    and (p_q is null or btrim(p_q) = '' or c.nom ilike '%' || btrim(p_q) || '%' or coalesce(c.description, '') ilike '%' || btrim(p_q) || '%')
$$;
revoke all on function groupes_visibles(text) from public, anon;
grant execute on function groupes_visibles(text) to authenticated;

-- ------------------------------------------------------------
-- 3. Rejoindre : d'un tap (ouvert) ou par une demande (sur demande)
-- ------------------------------------------------------------
create or replace function rejoindre_groupe(p_id bigint) returns text
language plpgsql security definer set search_path = public as $$
declare c conversations; d groupe_demandes;
begin
  if mon_statut() <> 'valide' then raise exception 'Réservé aux membres validés.'; end if;
  select * into c from conversations where id = p_id;
  if c.id is null or not groupe_visible(c) then raise exception 'Ce groupe n''est pas ouvert.'; end if;
  if exists (select 1 from conversation_membres where conversation_id = p_id and membre = auth.uid()) then return 'membre'; end if;
  if c.acces = 'ouvert' then
    insert into conversation_membres (conversation_id, membre) values (p_id, auth.uid()) on conflict do nothing;
    delete from groupe_demandes where conversation_id = p_id and membre = auth.uid();
    return 'membre';
  end if;
  select * into d from groupe_demandes where conversation_id = p_id and membre = auth.uid();
  if d.statut = 'en_attente' then return 'demande'; end if;
  if d.statut = 'refusee' and d.traite_le > now() - interval '7 days' then
    raise exception 'Ta demande a été refusée il y a moins d''une semaine.';
  end if;
  insert into groupe_demandes (conversation_id, membre) values (p_id, auth.uid())
    on conflict (conversation_id, membre) do update set statut = 'en_attente', cree_le = now(), traite_le = null, traite_par = null;
  return 'demande';
end $$;
revoke all on function rejoindre_groupe(bigint) from public, anon;
grant execute on function rejoindre_groupe(bigint) to authenticated;

-- retirer sa demande
create or replace function retirer_demande_groupe(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from groupe_demandes where conversation_id = p_id and membre = auth.uid() and statut = 'en_attente';
end $$;
revoke all on function retirer_demande_groupe(bigint) from public, anon;
grant execute on function retirer_demande_groupe(bigint) to authenticated;

-- ------------------------------------------------------------
-- 4. Les demandes, côté créateur (ou modérateur)
-- ------------------------------------------------------------
create or replace function demandes_groupe(p_id bigint) returns json
language sql stable security invoker set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', p.id, 'prenom', p.prenom, 'nom', p.nom, 'photo_url', p.photo_url,
                                             'promo', (select numero from promotions where id = p.promotion_id), 'cree_le', d.cree_le)
                  order by d.cree_le), '[]'::json)
    from groupe_demandes d join profiles p on p.id = d.membre
   where d.conversation_id = p_id and d.statut = 'en_attente'
     and (anime_le_groupe(p_id) or est_moderateur())
$$;
revoke all on function demandes_groupe(bigint) from public, anon;
grant execute on function demandes_groupe(bigint) to authenticated;

create or replace function traiter_demande_groupe(p_id bigint, p_membre uuid, p_accepter boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_nom text;
begin
  if not (anime_le_groupe(p_id) or est_moderateur()) then raise exception 'Seule la personne qui a créé le groupe peut traiter les demandes.'; end if;
  if not exists (select 1 from groupe_demandes where conversation_id = p_id and membre = p_membre and statut = 'en_attente') then
    raise exception 'Demande introuvable.';
  end if;
  select nom into v_nom from conversations where id = p_id;
  if p_accepter then
    insert into conversation_membres (conversation_id, membre) values (p_id, p_membre) on conflict do nothing;   -- le déclencheur prévient la personne
    delete from groupe_demandes where conversation_id = p_id and membre = p_membre;
  else
    update groupe_demandes set statut = 'refusee', traite_le = now(), traite_par = auth.uid()
     where conversation_id = p_id and membre = p_membre;
    perform envoyer_push_liste(array[p_membre], coalesce(v_nom, 'Groupe'), 'Ta demande n''a pas été retenue cette fois.',
      '/messages/groupes', 'messages', 'demande-' || p_id);
  end if;
  if not anime_le_groupe(p_id) then   -- un modérateur qui n'est pas le créateur : tracé
    perform journaliser(case when p_accepter then 'demande_groupe_acceptee' else 'demande_groupe_refusee' end,
                        p_membre, jsonb_build_object('conversation', p_id));
  end if;
end $$;
revoke all on function traiter_demande_groupe(bigint, uuid, boolean) from public, anon;
grant execute on function traiter_demande_groupe(bigint, uuid, boolean) to authenticated;

-- une seule notification par groupe au créateur, remplacée à chaque nouvelle demande
create or replace function push_demande_groupe() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_conv conversations; v_n int;
begin
  if new.statut <> 'en_attente' then return new; end if;
  select * into v_conv from conversations where id = new.conversation_id;
  if v_conv.cree_par is null then return new; end if;
  select count(*) into v_n from groupe_demandes where conversation_id = new.conversation_id and statut = 'en_attente';
  perform envoyer_push_liste(array[v_conv.cree_par], coalesce(v_conv.nom, 'Ton groupe'),
    v_n || ' demande' || case when v_n > 1 then 's' else '' end || ' en attente pour rejoindre le groupe',
    '/messages/' || new.conversation_id, 'messages', 'demandes-' || new.conversation_id);
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists groupe_demandes_push on groupe_demandes;
create trigger groupe_demandes_push after insert or update of statut on groupe_demandes
  for each row execute function push_demande_groupe();

-- ------------------------------------------------------------
-- 5. Registre des fonctions ouvertes
-- ------------------------------------------------------------
insert into sante_fonctions_ouvertes (nom, raison) values
  ('groupes_visibles',        'groupes : l''annuaire des groupes qu''on peut rejoindre'),
  ('rejoindre_groupe',        'groupes : rejoindre (ouvert) ou demander (sur demande)'),
  ('retirer_demande_groupe',  'groupes : retirer sa demande'),
  ('demandes_groupe',         'groupes : les demandes en attente (créateur, modérateurs)'),
  ('traiter_demande_groupe',  'groupes : accepter/refuser une demande (journalisé si modérateur)')
on conflict (nom) do nothing;

-- Vérifications :
--   select column_name from information_schema.columns where table_name = 'conversations' and column_name in ('acces', 'visibilite', 'officiel');   -- 3
--   select groupes_visibles();   -- [] tant qu'aucun groupe n'est ouvert
