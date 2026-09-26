-- ============================================================
-- Migration 53 — MESSAGES (chantier « réseau social », brique 2)
--   Conversations à deux (« duo ») et groupes, ouvertes à tous les membres
--   validés. Les MESSAGES s'effacent au bout de 30 jours (tâche quotidienne),
--   les conversations et les groupes restent. Un groupe se supprime à la
--   main (son créateur ou un admin). Temps réel via Supabase Realtime sur
--   la table messages (la RLS filtre ce que chacun reçoit). Notification
--   push aux autres membres, au plus une par conversation toutes les 10 min,
--   famille « messages » (nouvel interrupteur dans Mon profil).
--   Rejouable. Se termine par ses GRANT explicites (CONTRIBUTING § Pièges).
-- ============================================================

-- ------------------------------------------------------------
-- 0. Préférence push « messages »
-- ------------------------------------------------------------
alter table profiles add column if not exists push_messages boolean not null default true;
grant select (push_messages) on profiles to authenticated;
grant update (push_messages) on profiles to authenticated;

-- ------------------------------------------------------------
-- 1. Tables
-- ------------------------------------------------------------
create table if not exists conversations (
  id                 bigserial primary key,
  type               text not null check (type in ('duo', 'groupe')),
  nom                text check (nom is null or char_length(btrim(nom)) between 1 and 60),   -- groupes
  cree_par           uuid references profiles(id) on delete set null,
  cree_le            timestamptz not null default now(),
  dernier_message_le timestamptz
);
create index if not exists conversations_dernier_idx on conversations (dernier_message_le desc nulls last);

create table if not exists conversation_membres (
  conversation_id bigint not null references conversations(id) on delete cascade,
  membre          uuid   not null references profiles(id) on delete cascade,
  rejoint_le      timestamptz not null default now(),
  lu_le           timestamptz not null default now(),   -- dernière lecture : sert au compteur de non lus
  notifie_le      timestamptz,                          -- dernière push envoyée pour cette conversation
  primary key (conversation_id, membre)
);
create index if not exists conversation_membres_membre_idx on conversation_membres (membre);

create table if not exists messages (
  id              bigserial primary key,
  conversation_id bigint not null references conversations(id) on delete cascade,
  auteur          uuid   not null references profiles(id) on delete cascade,
  texte           text   not null check (char_length(btrim(texte)) between 1 and 2000),
  cree_le         timestamptz not null default now()
);
create index if not exists messages_conversation_idx on messages (conversation_id, cree_le desc);
create index if not exists messages_cree_idx on messages (cree_le);

-- ------------------------------------------------------------
-- 2. Qui est dans quelle conversation (definer : les politiques s'en servent
--    sans dépendre des droits sur conversation_membres)
-- ------------------------------------------------------------
create or replace function est_dans_conversation(p_conversation bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from conversation_membres
                 where conversation_id = p_conversation and membre = auth.uid());
$$;
revoke all on function est_dans_conversation(bigint) from public, anon;
grant execute on function est_dans_conversation(bigint) to authenticated;

-- créateur d'un groupe ? (pour renommer, ajouter ou retirer des membres)
create or replace function anime_le_groupe(p_conversation bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from conversations
                 where id = p_conversation and type = 'groupe' and cree_par = auth.uid());
$$;
revoke all on function anime_le_groupe(bigint) from public, anon;
grant execute on function anime_le_groupe(bigint) to authenticated;

-- ------------------------------------------------------------
-- 3. Droits et politiques
-- ------------------------------------------------------------
grant select, update, delete on conversations to authenticated;
grant select, insert, update, delete on conversation_membres to authenticated;
grant select, insert, delete on messages to authenticated;
grant usage, select on sequence conversations_id_seq to authenticated;
grant usage, select on sequence messages_id_seq to authenticated;
alter table conversations enable row level security;
alter table conversation_membres enable row level security;
alter table messages enable row level security;

-- conversations : je vois les miennes ; je renomme mon groupe ; je supprime
-- mon groupe (ou un admin) — la création passe par ouvrir_duo / creer_groupe
drop policy if exists conversations_lecture on conversations;
create policy conversations_lecture on conversations
  for select to authenticated using (mon_statut() = 'valide' and est_dans_conversation(id));
drop policy if exists conversations_renommage on conversations;
create policy conversations_renommage on conversations
  for update to authenticated using (anime_le_groupe(id)) with check (anime_le_groupe(id) and type = 'groupe');
drop policy if exists conversations_suppression on conversations;
create policy conversations_suppression on conversations
  for delete to authenticated using (type = 'groupe' and (cree_par = auth.uid() or est_admin()));

-- membres : je vois qui est là ; le créateur d'un groupe ajoute des membres
-- validés ; chacun peut quitter, le créateur peut retirer ; je mets à jour
-- MA date de lecture
drop policy if exists membres_lecture on conversation_membres;
create policy membres_lecture on conversation_membres
  for select to authenticated using (est_dans_conversation(conversation_id));
drop policy if exists membres_ajout on conversation_membres;
create policy membres_ajout on conversation_membres
  for insert to authenticated
  with check (anime_le_groupe(conversation_id)
              and exists (select 1 from profiles where id = membre and statut_compte = 'valide'));
drop policy if exists membres_depart on conversation_membres;
create policy membres_depart on conversation_membres
  for delete to authenticated using (membre = auth.uid() or anime_le_groupe(conversation_id));
drop policy if exists membres_lecture_maj on conversation_membres;
create policy membres_lecture_maj on conversation_membres
  for update to authenticated using (membre = auth.uid()) with check (membre = auth.uid());

-- messages : lus et écrits par les membres de la conversation ; l'auteur
-- (ou un admin) supprime
drop policy if exists messages_lecture on messages;
create policy messages_lecture on messages
  for select to authenticated using (mon_statut() = 'valide' and est_dans_conversation(conversation_id));
drop policy if exists messages_envoi on messages;
create policy messages_envoi on messages
  for insert to authenticated
  with check (mon_statut() = 'valide' and auteur = auth.uid() and est_dans_conversation(conversation_id));
drop policy if exists messages_suppression on messages;
create policy messages_suppression on messages
  for delete to authenticated using (auteur = auth.uid() or est_admin());

-- ------------------------------------------------------------
-- 4. Ouvrir une conversation
-- ------------------------------------------------------------
-- à deux : la conversation existante avec cette personne, sinon une nouvelle
create or replace function ouvrir_duo(p_autre uuid) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if mon_statut() <> 'valide' then raise exception 'compte non validé'; end if;
  if p_autre is null or p_autre = auth.uid() then raise exception 'destinataire invalide'; end if;
  if not exists (select 1 from profiles where id = p_autre and statut_compte = 'valide') then
    raise exception 'ce membre n''est pas joignable';
  end if;
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
revoke all on function ouvrir_duo(uuid) from public, anon;
grant execute on function ouvrir_duo(uuid) to authenticated;

-- un groupe : le créateur + les membres validés choisis (les autres ignorés)
create or replace function creer_groupe(p_nom text, p_membres uuid[]) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if mon_statut() <> 'valide' then raise exception 'compte non validé'; end if;
  if p_nom is null or char_length(btrim(p_nom)) = 0 then raise exception 'le groupe doit avoir un nom'; end if;
  insert into conversations (type, nom, cree_par) values ('groupe', btrim(p_nom), auth.uid()) returning id into v_id;
  insert into conversation_membres (conversation_id, membre)
  select v_id, id from profiles
   where statut_compte = 'valide' and (id = auth.uid() or id = any(coalesce(p_membres, '{}')))
  on conflict do nothing;
  return v_id;
end $$;
revoke all on function creer_groupe(text, uuid[]) from public, anon;
grant execute on function creer_groupe(text, uuid[]) to authenticated;

-- ------------------------------------------------------------
-- 5. Lecture : mes conversations, mes non lus, marquer lu
-- ------------------------------------------------------------
create or replace function mes_conversations() returns json
language sql stable security invoker set search_path = public as $$
  select coalesce(json_agg(json_build_object(
    'id', c.id,
    'type', c.type,
    'nom', c.nom,
    'cree_par', c.cree_par,
    'dernier_message_le', c.dernier_message_le,
    'membres', (select json_agg(json_build_object('id', p.id, 'prenom', p.prenom, 'nom', p.nom, 'photo_url', p.photo_url) order by p.prenom)
                  from conversation_membres m join profiles p on p.id = m.membre
                 where m.conversation_id = c.id and m.membre <> auth.uid()),
    'nb_membres', (select count(*) from conversation_membres m where m.conversation_id = c.id),
    'dernier', (select json_build_object('texte', x.texte, 'auteur', x.auteur, 'prenom', a.prenom, 'cree_le', x.cree_le)
                  from messages x join profiles a on a.id = x.auteur
                 where x.conversation_id = c.id order by x.cree_le desc limit 1),
    'non_lus', (select count(*) from messages x
                 where x.conversation_id = c.id and x.auteur <> auth.uid() and x.cree_le > moi.lu_le)
  ) order by c.dernier_message_le desc nulls last, c.cree_le desc), '[]'::json)
  from conversations c
  join conversation_membres moi on moi.conversation_id = c.id and moi.membre = auth.uid()
$$;
revoke all on function mes_conversations() from public, anon;
grant execute on function mes_conversations() to authenticated;

create or replace function messages_non_lus() returns integer
language sql stable security invoker set search_path = public as $$
  select coalesce(sum((select count(*) from messages x
                        where x.conversation_id = moi.conversation_id
                          and x.auteur <> auth.uid() and x.cree_le > moi.lu_le)), 0)::int
  from conversation_membres moi where moi.membre = auth.uid()
$$;
revoke all on function messages_non_lus() from public, anon;
grant execute on function messages_non_lus() to authenticated;

create or replace function marquer_lu(p_conversation bigint) returns void
language sql security invoker set search_path = public as $$
  update conversation_membres set lu_le = now()
   where conversation_id = p_conversation and membre = auth.uid()
$$;
revoke all on function marquer_lu(bigint) from public, anon;
grant execute on function marquer_lu(bigint) to authenticated;

-- ------------------------------------------------------------
-- 6. À chaque message : horodatage de la conversation + push mesurée
--    (aux autres membres, au plus une par conversation toutes les 10 min ;
--     l'auteur d'un message est réputé avoir lu jusqu'ici)
-- ------------------------------------------------------------
create or replace function apres_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_conv   conversations%rowtype;
  v_qui    text;
  v_titre  text;
  v_cibles uuid[];
begin
  select * into v_conv from conversations where id = new.conversation_id;
  update conversations set dernier_message_le = new.cree_le where id = new.conversation_id;
  update conversation_membres set lu_le = new.cree_le
   where conversation_id = new.conversation_id and membre = new.auteur;

  select prenom || ' ' || nom into v_qui from profiles where id = new.auteur;
  v_titre := case when v_conv.type = 'groupe' then coalesce(v_conv.nom, 'Groupe') else v_qui end;

  select array_agg(membre) into v_cibles
    from conversation_membres
   where conversation_id = new.conversation_id and membre <> new.auteur
     and (notifie_le is null or notifie_le < now() - interval '10 minutes');
  if v_cibles is not null then
    update conversation_membres set notifie_le = now()
     where conversation_id = new.conversation_id and membre = any(v_cibles);
    perform envoyer_push_liste(v_cibles, v_titre,
      case when v_conv.type = 'groupe' then v_qui || ' : ' else '' end || left(new.texte, 100),
      '/messages/' || new.conversation_id, 'messages');
  end if;
  return new;
end $$;
drop trigger if exists messages_apres_insert on messages;
create trigger messages_apres_insert after insert on messages
  for each row execute function apres_message();

-- le texte est nettoyé à l'entrée
create or replace function messages_avant_insert() returns trigger
language plpgsql as $$
begin new.texte := btrim(new.texte); return new; end $$;
drop trigger if exists messages_avant_insert on messages;
create trigger messages_avant_insert before insert on messages
  for each row execute function messages_avant_insert();

-- ------------------------------------------------------------
-- 7. Purge : les messages de plus de 30 jours disparaissent (pas les
--    conversations ni les groupes)
-- ------------------------------------------------------------
create or replace function purge_messages() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from messages where cree_le < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function purge_messages() from public, anon, authenticated;
select cron.schedule('purge-messages', '45 4 * * *', $$select purge_messages()$$);

-- ------------------------------------------------------------
-- 8. Temps réel : la table messages est diffusée (la RLS filtre par membre)
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table messages;
  end if;
end $$;

-- ------------------------------------------------------------
-- 9. Contrôle de santé : les RPC que le navigateur a le droit d'appeler
-- ------------------------------------------------------------
insert into sante_fonctions_ouvertes (nom, raison) values
  ('est_dans_conversation', 'messages : suis-je membre de cette conversation ?'),
  ('anime_le_groupe',       'messages : ai-je créé ce groupe ?'),
  ('ouvrir_duo',            'messages : ouvrir (ou retrouver) une conversation à deux'),
  ('creer_groupe',          'messages : créer un groupe'),
  ('mes_conversations',     'messages : ma liste de conversations'),
  ('messages_non_lus',      'messages : total des non lus (pastille)'),
  ('marquer_lu',            'messages : marquer une conversation lue')
on conflict (nom) do nothing;

-- Vérifications (une instruction à la fois dans l'éditeur SQL) :
--   select count(*) from pg_policies where tablename in ('conversations','conversation_membres','messages');  -- 10
--   select jobname from cron.job where jobname = 'purge-messages';
--   select tablename from pg_publication_tables where pubname = 'supabase_realtime';  -- messages présent
--   select * from sante_systeme where verdict like 'PROBL%';   -- rien = tout va bien
