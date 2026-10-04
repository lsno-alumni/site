-- ============================================================
-- Migration 56 — MESSAGERIE : sécurité et confort (décision du 26/09)
--   1. Bloquer un membre : plus de conversation à deux possible, ses
--      messages disparaissent de ma vue dans les groupes, plus de push.
--   2. Signaler un message (rejoint les signalements des modérateurs, qui
--      peuvent supprimer le message : admin_supprimer_message, journalisé).
--   3. Stockage : admin_stockage() compte fichiers et octets par bucket.
--   4. Groupes : photo et description ; message épinglé.
--   5. Sondages dans une conversation (votes en temps réel).
--   Rejouable. Se termine par ses GRANT explicites.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Blocages
-- ------------------------------------------------------------
create table if not exists blocages (
  bloqueur uuid not null references profiles(id) on delete cascade,
  bloque   uuid not null references profiles(id) on delete cascade,
  cree_le  timestamptz not null default now(),
  primary key (bloqueur, bloque),
  check (bloqueur <> bloque)
);
grant select, insert, delete on blocages to authenticated;
alter table blocages enable row level security;
drop policy if exists blocages_lecture on blocages;
create policy blocages_lecture on blocages for select to authenticated using (bloqueur = auth.uid());
drop policy if exists blocages_ajout on blocages;
create policy blocages_ajout on blocages for insert to authenticated with check (bloqueur = auth.uid());
drop policy if exists blocages_retrait on blocages;
create policy blocages_retrait on blocages for delete to authenticated using (bloqueur = auth.uid());

-- l'un des deux a bloqué l'autre ? (definer : personne ne voit qui l'a bloqué)
create or replace function est_bloque_entre(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocages where (bloqueur = a and bloque = b) or (bloqueur = b and bloque = a));
$$;
revoke all on function est_bloque_entre(uuid, uuid) from public, anon;
grant execute on function est_bloque_entre(uuid, uuid) to authenticated;

-- plus de conversation à deux entre deux personnes dont l'une bloque l'autre
create or replace function ouvrir_duo(p_autre uuid) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if mon_statut() <> 'valide' then raise exception 'compte non validé'; end if;
  if p_autre is null or p_autre = auth.uid() then raise exception 'destinataire invalide'; end if;
  if not exists (select 1 from profiles where id = p_autre and statut_compte = 'valide') then
    raise exception 'ce membre n''est pas joignable';
  end if;
  if est_bloque_entre(auth.uid(), p_autre) then raise exception 'conversation impossible avec ce membre'; end if;
  select c.id into v_id
    from conversations c
    join conversation_membres a on a.conversation_id = c.id and a.membre = auth.uid()
    join conversation_membres b on b.conversation_id = c.id and b.membre = p_autre
   where c.type = 'duo' limit 1;
  if v_id is not null then return v_id; end if;
  insert into conversations (type, cree_par) values ('duo', auth.uid()) returning id into v_id;
  insert into conversation_membres (conversation_id, membre) values (v_id, auth.uid()), (v_id, p_autre);
  return v_id;
end $$;

-- je ne vois pas les messages d'une personne bloquée (ni elle les miens) ;
-- dans une conversation à deux, plus d'envoi possible
drop policy if exists messages_lecture on messages;
create policy messages_lecture on messages
  for select to authenticated
  using (mon_statut() = 'valide' and est_dans_conversation(conversation_id) and not est_bloque_entre(auth.uid(), auteur));
drop policy if exists messages_envoi on messages;
create policy messages_envoi on messages
  for insert to authenticated
  with check (mon_statut() = 'valide' and auteur = auth.uid() and est_dans_conversation(conversation_id)
              and not exists (select 1 from conversation_membres m join conversations c on c.id = m.conversation_id
                               where m.conversation_id = messages.conversation_id and c.type = 'duo'
                                 and m.membre <> auth.uid() and est_bloque_entre(auth.uid(), m.membre)));

-- ------------------------------------------------------------
-- 2. Signaler un message ; le modérateur peut le supprimer
-- ------------------------------------------------------------
alter table signalements drop constraint if exists signalements_cible_type_check;
alter table signalements add constraint signalements_cible_type_check
  check (cible_type in ('publication', 'commentaire', 'offre', 'message'));

create or replace function push_signalement() returns trigger
language plpgsql security definer set search_path = public as $$
declare cibles uuid[];
begin
  select array_agg(id) into cibles from profiles
   where statut_compte = 'valide' and role in ('delegue', 'admin') and id <> new.auteur;
  if cibles is not null then
    perform envoyer_push_liste(cibles, 'Un contenu a été signalé',
      'Un membre signale ' || case new.cible_type when 'publication' then 'une publication'
                                                  when 'commentaire' then 'un commentaire'
                                                  when 'message' then 'un message' else 'une offre' end
      || ' : ' || left(new.motif, 100), '/admin', null);
  end if;
  return new;
end $$;

create or replace function admin_supprimer_message(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare v_auteur uuid; v_texte text;
begin
  if not est_moderateur() then raise exception 'réservé aux modérateurs'; end if;
  select auteur, left(texte, 120) into v_auteur, v_texte from messages where id = p_id;
  if v_auteur is null then return; end if;
  delete from messages where id = p_id;
  perform journaliser('suppression_message', v_auteur, jsonb_build_object('message', p_id, 'texte', v_texte));
end $$;
revoke all on function admin_supprimer_message(bigint) from public, anon;
grant execute on function admin_supprimer_message(bigint) to authenticated;

-- ------------------------------------------------------------
-- 3. Stockage par bucket (modérateurs)
-- ------------------------------------------------------------
create or replace function admin_stockage() returns json
language sql stable security definer set search_path = public as $$
  select case when est_moderateur() then
    coalesce((select json_agg(json_build_object('bucket', bucket_id, 'fichiers', n, 'octets', octets) order by octets desc)
              from (select bucket_id, count(*) as n, coalesce(sum((metadata->>'size')::bigint), 0) as octets
                      from storage.objects group by bucket_id) t), '[]'::json)
  else '[]'::json end;
$$;
revoke all on function admin_stockage() from public, anon;
grant execute on function admin_stockage() to authenticated;

-- ------------------------------------------------------------
-- 4. Groupes : photo, description, message épinglé
-- ------------------------------------------------------------
alter table conversations add column if not exists photo_url       text;
alter table conversations add column if not exists description     text check (description is null or char_length(description) <= 300);
alter table conversations add column if not exists message_epingle bigint references messages(id) on delete set null;

-- n'importe quel membre épingle (ou désépingle : p_message null)
create or replace function epingler_message(p_conversation bigint, p_message bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not est_dans_conversation(p_conversation) then raise exception 'pas membre'; end if;
  if p_message is not null and not exists (select 1 from messages where id = p_message and conversation_id = p_conversation) then
    raise exception 'message inconnu';
  end if;
  update conversations set message_epingle = p_message where id = p_conversation;
end $$;
revoke all on function epingler_message(bigint, bigint) from public, anon;
grant execute on function epingler_message(bigint, bigint) to authenticated;

-- ------------------------------------------------------------
-- 5. Sondages
-- ------------------------------------------------------------
create table if not exists sondages (
  id              bigserial primary key,
  conversation_id bigint not null references conversations(id) on delete cascade,
  auteur          uuid   not null references profiles(id) on delete cascade,
  question        text   not null check (char_length(btrim(question)) between 1 and 200),
  choix           text[] not null check (array_length(choix, 1) between 2 and 6),
  multiple        boolean not null default false,
  cree_le         timestamptz not null default now()
);
create table if not exists sondage_votes (
  sondage_id bigint not null references sondages(id) on delete cascade,
  membre     uuid   not null references profiles(id) on delete cascade,
  choix      int[]  not null,
  maj_le     timestamptz not null default now(),
  primary key (sondage_id, membre)
);
grant select, insert on sondages to authenticated;
grant usage, select on sequence sondages_id_seq to authenticated;
grant select, insert, update, delete on sondage_votes to authenticated;
alter table sondages enable row level security;
alter table sondage_votes enable row level security;

create or replace function sondage_dans_ma_conversation(p_sondage bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from sondages s join conversation_membres c on c.conversation_id = s.conversation_id
                 where s.id = p_sondage and c.membre = auth.uid());
$$;
revoke all on function sondage_dans_ma_conversation(bigint) from public, anon;
grant execute on function sondage_dans_ma_conversation(bigint) to authenticated;

drop policy if exists sondages_lecture on sondages;
create policy sondages_lecture on sondages for select to authenticated using (est_dans_conversation(conversation_id));
drop policy if exists sondages_creation on sondages;
create policy sondages_creation on sondages for insert to authenticated
  with check (mon_statut() = 'valide' and auteur = auth.uid() and est_dans_conversation(conversation_id));
drop policy if exists votes_lecture on sondage_votes;
create policy votes_lecture on sondage_votes for select to authenticated using (sondage_dans_ma_conversation(sondage_id));
drop policy if exists votes_ajout on sondage_votes;
create policy votes_ajout on sondage_votes for insert to authenticated with check (membre = auth.uid() and sondage_dans_ma_conversation(sondage_id));
drop policy if exists votes_maj on sondage_votes;
create policy votes_maj on sondage_votes for update to authenticated using (membre = auth.uid()) with check (membre = auth.uid());
drop policy if exists votes_retrait on sondage_votes;
create policy votes_retrait on sondage_votes for delete to authenticated using (membre = auth.uid());

alter table sondage_votes replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sondage_votes') then
    alter publication supabase_realtime add table sondage_votes;
  end if;
end $$;

-- le message qui porte le sondage
alter table messages add column if not exists sondage_id bigint references sondages(id) on delete set null;
alter table messages drop constraint if exists messages_texte_check;
alter table messages add constraint messages_texte_check
  check (char_length(btrim(texte)) <= 2000 and (char_length(btrim(texte)) >= 1 or fichier_chemin is not null or sondage_id is not null));

-- ------------------------------------------------------------
-- 6. Lectures et push mises à jour (photo, description, épinglé, sondage, blocage)
-- ------------------------------------------------------------
create or replace function mes_conversations() returns json
language sql stable security invoker set search_path = public as $$
  select coalesce(json_agg(json_build_object(
    'id', c.id,
    'type', c.type,
    'nom', c.nom,
    'photo_url', c.photo_url,
    'description', c.description,
    'cree_par', c.cree_par,
    'dernier_message_le', c.dernier_message_le,
    'muet', moi.muet,
    'epingle', moi.epingle,
    'membres', (select json_agg(json_build_object('id', p.id, 'prenom', p.prenom, 'nom', p.nom, 'photo_url', p.photo_url) order by p.prenom)
                  from conversation_membres m join profiles p on p.id = m.membre
                 where m.conversation_id = c.id and m.membre <> auth.uid()),
    'nb_membres', (select count(*) from conversation_membres m where m.conversation_id = c.id),
    'dernier', (select json_build_object('texte', x.texte, 'auteur', x.auteur, 'prenom', a.prenom, 'cree_le', x.cree_le,
                                         'fichier_type', x.fichier_type, 'fichier_nom', x.fichier_nom,
                                         'sondage', (select question from sondages s where s.id = x.sondage_id))
                  from messages x join profiles a on a.id = x.auteur
                 where x.conversation_id = c.id and not est_bloque_entre(auth.uid(), x.auteur)
                 order by x.cree_le desc limit 1),
    'non_lus', (select count(*) from messages x
                 where x.conversation_id = c.id and x.auteur <> auth.uid() and x.cree_le > moi.lu_le
                   and not est_bloque_entre(auth.uid(), x.auteur))
  ) order by moi.epingle desc, c.dernier_message_le desc nulls last, c.cree_le desc), '[]'::json)
  from conversations c
  join conversation_membres moi on moi.conversation_id = c.id and moi.membre = auth.uid()
$$;

create or replace function messages_non_lus() returns integer
language sql stable security invoker set search_path = public as $$
  select coalesce(sum((select count(*) from messages x
                        where x.conversation_id = moi.conversation_id
                          and x.auteur <> auth.uid() and x.cree_le > moi.lu_le
                          and not est_bloque_entre(auth.uid(), x.auteur))), 0)::int
  from conversation_membres moi where moi.membre = auth.uid() and not moi.muet
$$;

create or replace function apres_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_conv   conversations%rowtype;
  v_qui    text;
  v_titre  text;
  v_corps  text;
  v_cibles uuid[];
begin
  select * into v_conv from conversations where id = new.conversation_id;
  update conversations set dernier_message_le = new.cree_le where id = new.conversation_id;
  update conversation_membres set lu_le = new.cree_le
   where conversation_id = new.conversation_id and membre = new.auteur;

  select prenom || ' ' || nom into v_qui from profiles where id = new.auteur;
  v_titre := case when v_conv.type = 'groupe' then coalesce(v_conv.nom, 'Groupe') else v_qui end;
  v_corps := case
    when btrim(new.texte) <> '' then left(new.texte, 100)
    when new.sondage_id is not null then 'Sondage : ' || coalesce((select left(question, 80) from sondages where id = new.sondage_id), '')
    when new.fichier_type = 'photo' then 'Photo'
    when new.fichier_type = 'video' then 'Vidéo'
    when new.fichier_type = 'audio' then 'Message vocal'
    when new.fichier_type = 'lien'  then 'Lien : ' || coalesce(new.fichier_nom, '')
    else 'Fichier : ' || coalesce(new.fichier_nom, 'document') end;

  select array_agg(membre) into v_cibles
    from conversation_membres
   where conversation_id = new.conversation_id and membre <> new.auteur
     and not muet
     and not est_bloque_entre(membre, new.auteur)
     and not (membre = any(coalesce(new.mentions, '{}')));
  if v_cibles is not null then
    perform envoyer_push_liste(v_cibles, v_titre,
      case when v_conv.type = 'groupe' then v_qui || ' : ' else '' end || v_corps,
      '/messages/' || new.conversation_id, 'messages', 'conv-' || new.conversation_id);
  end if;
  return new;
end $$;

-- ------------------------------------------------------------
-- 7. Contrôle de santé : les RPC que le navigateur a le droit d'appeler
-- ------------------------------------------------------------
insert into sante_fonctions_ouvertes (nom, raison) values
  ('est_bloque_entre',             'messages : l''un des deux a-t-il bloqué l''autre ?'),
  ('admin_supprimer_message',      'modération : supprimer un message signalé (journalisé)'),
  ('admin_stockage',               'admin : fichiers et octets par bucket'),
  ('epingler_message',             'messages : épingler un message dans une conversation'),
  ('sondage_dans_ma_conversation', 'messages : ce sondage est-il dans une de mes conversations ?')
on conflict (nom) do nothing;

-- Vérifications (une instruction à la fois dans l'éditeur SQL) :
--   select to_regclass('public.blocages'), to_regclass('public.sondages'), to_regclass('public.sondage_votes');
--   select column_name from information_schema.columns where table_name = 'conversations' and column_name in ('photo_url','description','message_epingle');  -- 3
--   select tablename from pg_publication_tables where pubname = 'supabase_realtime';  -- + sondage_votes
--   select * from sante_systeme where verdict like 'PROBL%';   -- rien = tout va bien
