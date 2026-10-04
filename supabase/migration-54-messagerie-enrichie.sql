-- ============================================================
-- Migration 54 — MESSAGERIE ENRICHIE : pièces jointes, durée de vie, vu,
--   réponse, réactions, sourdine/épingle, recherche, modification
--   Une photo (réduite sur le téléphone), une vidéo (30 s, 20 Mo) ou un PDF
--   (10 Mo) par message, avec ou sans texte. Rangées dans un bucket PRIVÉ
--   « pieces » : chemin « <conversation>/<uuid-auteur>/<horodatage>.<ext> »,
--   lecture réservée aux membres de la conversation (URL signées côté app).
--   Un message supprimé (à la main, par la purge à 30 jours, ou avec son
--   groupe) emporte son fichier.
--   ⚠ AVANT d'exécuter : créer le bucket Storage « pieces », PRIVÉ, 20 Mo,
--     types image/*, video/*, audio/*, application/pdf.
--   Rejouable. Se termine par ses GRANT explicites (CONTRIBUTING § Pièges).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Colonnes : le texte devient facultatif quand il y a une pièce
-- ------------------------------------------------------------
alter table messages add column if not exists fichier_chemin text;
alter table messages add column if not exists fichier_type   text check (fichier_type in ('photo', 'video', 'pdf'));
alter table messages add column if not exists fichier_nom    text;
alter table messages add column if not exists fichier_taille integer;
alter table messages drop constraint if exists messages_texte_check;
alter table messages add constraint messages_texte_check
  check (char_length(btrim(texte)) <= 2000 and (char_length(btrim(texte)) >= 1 or fichier_chemin is not null));

-- ------------------------------------------------------------
-- 2. Bucket « pieces » : politiques Storage
-- ------------------------------------------------------------
drop policy if exists "pieces_lecture" on storage.objects;
create policy "pieces_lecture" on storage.objects
  for select to authenticated
  using (bucket_id = 'pieces'
    and split_part(name, '/', 1) ~ '^[0-9]+$'
    and est_dans_conversation(split_part(name, '/', 1)::bigint));
drop policy if exists "pieces_ajout" on storage.objects;
create policy "pieces_ajout" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'pieces'
    and split_part(name, '/', 1) ~ '^[0-9]+$'
    and split_part(name, '/', 2) = auth.uid()::text
    and est_dans_conversation(split_part(name, '/', 1)::bigint)
    and (select statut_compte from profiles where id = auth.uid()) = 'valide');
drop policy if exists "pieces_suppression" on storage.objects;
create policy "pieces_suppression" on storage.objects
  for delete to authenticated
  using (bucket_id = 'pieces'
    and (split_part(name, '/', 2) = auth.uid()::text
         or (select role from profiles where id = auth.uid()) = 'admin'));

-- ------------------------------------------------------------
-- 3. Un message effacé emporte sa pièce (suppression à la main, purge,
--    groupe supprimé : la cascade passe aussi par ce déclencheur)
-- ------------------------------------------------------------
create or replace function apres_suppression_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare cle text;
begin
  if old.fichier_chemin is null then return old; end if;
  select decrypted_secret into cle from vault.decrypted_secrets where name = 'service_role_key';
  if cle is not null then
    perform net.http_delete(
      url     := 'https://pdjbqdwurwgxzghehldr.supabase.co/storage/v1/object/pieces/' || old.fichier_chemin,
      headers := jsonb_build_object('Authorization', 'Bearer ' || cle, 'apikey', cle));
  end if;
  return old;
exception when others then
  return old;   -- un fichier orphelin ne doit jamais empêcher la suppression
end $$;
drop trigger if exists messages_apres_delete on messages;
create trigger messages_apres_delete after delete on messages
  for each row execute function apres_suppression_message();

-- ------------------------------------------------------------
-- 4. Liste des conversations : l'aperçu dit « Photo », « Vidéo », « Fichier »
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
    'dernier', (select json_build_object('texte', x.texte, 'auteur', x.auteur, 'prenom', a.prenom, 'cree_le', x.cree_le,
                                         'fichier_type', x.fichier_type, 'fichier_nom', x.fichier_nom)
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

-- ------------------------------------------------------------
-- 5. Push : le corps dit ce qui est joint quand il n'y a pas de texte
-- ------------------------------------------------------------
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
    when new.fichier_type = 'photo' then 'Photo'
    when new.fichier_type = 'video' then 'Vidéo'
    else 'Fichier : ' || coalesce(new.fichier_nom, 'document') end;

  select array_agg(membre) into v_cibles
    from conversation_membres
   where conversation_id = new.conversation_id and membre <> new.auteur
     and not (membre = any(coalesce(new.mentions, '{}')));   -- les mentionnés reçoivent la mention
  if v_cibles is not null then
    perform envoyer_push_liste(v_cibles, v_titre,
      case when v_conv.type = 'groupe' then v_qui || ' : ' else '' end || v_corps,
      '/messages/' || new.conversation_id, 'messages', 'conv-' || new.conversation_id);
  end if;
  return new;
end $$;

-- ============================================================
-- SUITE — messagerie enrichie (décision du 26/09 : « je les prends tous »)
--   6.  Durée de vie des pièces selon leur poids : photo 30 j (réduite,
--       légère), PDF 14 j, vidéo et message vocal 7 j. Le message reste,
--       marqué « pièce expirée ». Nouveaux types : « audio » (vocal) et
--       « lien » (une offre, une publication ou un profil partagé en message,
--       sans fichier : chemin interne + titre).
--   7.  « Vu » : la date de lecture de chacun est déjà là (lu_le) ; la table
--       conversation_membres est diffusée en temps réel pour la voir bouger.
--   8.  Répondre à un message (citation) : reponse_a.
--   9.  Réactions sur un message (emoji), diffusées en temps réel.
--   10. Sourdine et épingle par membre ; la sourdine coupe la push.
--   11. Recherche dans mes conversations.
--   12. Modification d'un message dans les 5 minutes.
-- ============================================================

-- ------------------------------------------------------------
-- 6. Durée de vie des pièces
-- ------------------------------------------------------------
alter table messages drop constraint if exists messages_fichier_type_check;
alter table messages add constraint messages_fichier_type_check
  check (fichier_type in ('photo', 'video', 'pdf', 'audio', 'lien'));
alter table messages add column if not exists fichier_expire_le timestamptz;
alter table messages add column if not exists fichier_expiree   boolean not null default false;

create or replace function messages_avant_insert() returns trigger
language plpgsql as $$
begin
  new.texte := btrim(new.texte);
  if new.fichier_chemin is not null and new.fichier_expire_le is null then
    new.fichier_expire_le := case new.fichier_type
      when 'photo' then now() + interval '30 days'
      when 'pdf'   then now() + interval '14 days'
      when 'video' then now() + interval '7 days'
      when 'audio' then now() + interval '7 days'
      else null end;   -- lien : rien à purger
  end if;
  return new;
end $$;

-- un lien partagé n'est pas un objet Storage : le déclencheur de suppression l'ignore
create or replace function apres_suppression_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare cle text;
begin
  if old.fichier_chemin is null or old.fichier_type = 'lien' or old.fichier_expiree then return old; end if;
  select decrypted_secret into cle from vault.decrypted_secrets where name = 'service_role_key';
  if cle is not null then
    perform net.http_delete(
      url     := 'https://pdjbqdwurwgxzghehldr.supabase.co/storage/v1/object/pieces/' || old.fichier_chemin,
      headers := jsonb_build_object('Authorization', 'Bearer ' || cle, 'apikey', cle));
  end if;
  return old;
exception when others then
  return old;
end $$;

create or replace function purge_pieces() returns integer
language plpgsql security definer set search_path = public as $$
declare cle text; v record; n integer := 0;
begin
  select decrypted_secret into cle from vault.decrypted_secrets where name = 'service_role_key';
  for v in
    select id, fichier_chemin from messages
    where fichier_chemin is not null and not fichier_expiree and fichier_type <> 'lien'
      and fichier_expire_le is not null and fichier_expire_le < now()
  loop
    if cle is not null then
      perform net.http_delete(
        url     := 'https://pdjbqdwurwgxzghehldr.supabase.co/storage/v1/object/pieces/' || v.fichier_chemin,
        headers := jsonb_build_object('Authorization', 'Bearer ' || cle, 'apikey', cle));
    end if;
    update messages set fichier_chemin = null, fichier_expiree = true where id = v.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function purge_pieces() from public, anon, authenticated;
select cron.schedule('purge-pieces', '50 4 * * *', $$select purge_pieces()$$);

-- ------------------------------------------------------------
-- 7. « Vu » : conversation_membres en temps réel (les mises à jour de lu_le)
-- ------------------------------------------------------------
alter table conversation_membres replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversation_membres') then
    alter publication supabase_realtime add table conversation_membres;
  end if;
end $$;

-- ------------------------------------------------------------
-- 8. Répondre à un message
-- ------------------------------------------------------------
alter table messages add column if not exists reponse_a bigint references messages(id) on delete set null;

-- ------------------------------------------------------------
-- 9. Réactions sur un message
-- ------------------------------------------------------------
create table if not exists message_reactions (
  message_id bigint not null references messages(id) on delete cascade,
  membre     uuid   not null references profiles(id) on delete cascade,
  emoji      text   not null check (emoji in ('👍', '❤️', '😂', '😮', '😢', '🙏')),
  cree_le    timestamptz not null default now(),
  primary key (message_id, membre)
);
grant select, insert, update, delete on message_reactions to authenticated;
alter table message_reactions enable row level security;

create or replace function message_dans_ma_conversation(p_message bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from messages m join conversation_membres c on c.conversation_id = m.conversation_id
                 where m.id = p_message and c.membre = auth.uid());
$$;
revoke all on function message_dans_ma_conversation(bigint) from public, anon;
grant execute on function message_dans_ma_conversation(bigint) to authenticated;

drop policy if exists reactions_msg_lecture on message_reactions;
create policy reactions_msg_lecture on message_reactions
  for select to authenticated using (message_dans_ma_conversation(message_id));
drop policy if exists reactions_msg_ajout on message_reactions;
create policy reactions_msg_ajout on message_reactions
  for insert to authenticated with check (membre = auth.uid() and message_dans_ma_conversation(message_id));
drop policy if exists reactions_msg_maj on message_reactions;
create policy reactions_msg_maj on message_reactions
  for update to authenticated using (membre = auth.uid()) with check (membre = auth.uid());
drop policy if exists reactions_msg_retrait on message_reactions;
create policy reactions_msg_retrait on message_reactions
  for delete to authenticated using (membre = auth.uid());

alter table message_reactions replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_reactions') then
    alter publication supabase_realtime add table message_reactions;
  end if;
end $$;

-- ------------------------------------------------------------
-- 10. Sourdine et épingle (par membre) ; la sourdine coupe la push
-- ------------------------------------------------------------
alter table conversation_membres add column if not exists muet    boolean not null default false;
alter table conversation_membres add column if not exists epingle boolean not null default false;

create or replace function mes_conversations() returns json
language sql stable security invoker set search_path = public as $$
  select coalesce(json_agg(json_build_object(
    'id', c.id,
    'type', c.type,
    'nom', c.nom,
    'cree_par', c.cree_par,
    'dernier_message_le', c.dernier_message_le,
    'muet', moi.muet,
    'epingle', moi.epingle,
    'membres', (select json_agg(json_build_object('id', p.id, 'prenom', p.prenom, 'nom', p.nom, 'photo_url', p.photo_url) order by p.prenom)
                  from conversation_membres m join profiles p on p.id = m.membre
                 where m.conversation_id = c.id and m.membre <> auth.uid()),
    'nb_membres', (select count(*) from conversation_membres m where m.conversation_id = c.id),
    'dernier', (select json_build_object('texte', x.texte, 'auteur', x.auteur, 'prenom', a.prenom, 'cree_le', x.cree_le,
                                         'fichier_type', x.fichier_type, 'fichier_nom', x.fichier_nom)
                  from messages x join profiles a on a.id = x.auteur
                 where x.conversation_id = c.id order by x.cree_le desc limit 1),
    'non_lus', (select count(*) from messages x
                 where x.conversation_id = c.id and x.auteur <> auth.uid() and x.cree_le > moi.lu_le)
  ) order by moi.epingle desc, c.dernier_message_le desc nulls last, c.cree_le desc), '[]'::json)
  from conversations c
  join conversation_membres moi on moi.conversation_id = c.id and moi.membre = auth.uid()
$$;
revoke all on function mes_conversations() from public, anon;
grant execute on function mes_conversations() to authenticated;

-- la pastille ne compte pas les conversations en sourdine
create or replace function messages_non_lus() returns integer
language sql stable security invoker set search_path = public as $$
  select coalesce(sum((select count(*) from messages x
                        where x.conversation_id = moi.conversation_id
                          and x.auteur <> auth.uid() and x.cree_le > moi.lu_le)), 0)::int
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
    when new.fichier_type = 'photo' then 'Photo'
    when new.fichier_type = 'video' then 'Vidéo'
    when new.fichier_type = 'audio' then 'Message vocal'
    when new.fichier_type = 'lien'  then 'Lien : ' || coalesce(new.fichier_nom, '')
    else 'Fichier : ' || coalesce(new.fichier_nom, 'document') end;

  select array_agg(membre) into v_cibles
    from conversation_membres
   where conversation_id = new.conversation_id and membre <> new.auteur
     and not muet                                                   -- sourdine
     and not (membre = any(coalesce(new.mentions, '{}')));         -- les mentionnés reçoivent la mention
  if v_cibles is not null then
    perform envoyer_push_liste(v_cibles, v_titre,
      case when v_conv.type = 'groupe' then v_qui || ' : ' else '' end || v_corps,
      '/messages/' || new.conversation_id, 'messages', 'conv-' || new.conversation_id);
  end if;
  return new;
end $$;

-- ------------------------------------------------------------
-- 11. Recherche dans mes conversations
-- ------------------------------------------------------------
create or replace function chercher_messages(p_q text) returns json
language sql stable security invoker set search_path = public as $$
  select coalesce(json_agg(json_build_object(
    'id', m.id, 'conversation_id', m.conversation_id, 'texte', m.texte, 'cree_le', m.cree_le,
    'prenom', a.prenom, 'nom', a.nom,
    'conversation', case when c.type = 'groupe' then coalesce(c.nom, 'Groupe')
                         else (select p.prenom || ' ' || p.nom from conversation_membres x join profiles p on p.id = x.membre
                               where x.conversation_id = c.id and x.membre <> auth.uid() limit 1) end
  ) order by m.cree_le desc), '[]'::json)
  from (
    select * from messages
    where texte ilike '%' || btrim(coalesce(p_q, '')) || '%' and char_length(btrim(coalesce(p_q, ''))) >= 2
    order by cree_le desc limit 30
  ) m
  join profiles a on a.id = m.auteur
  join conversations c on c.id = m.conversation_id
$$;
revoke all on function chercher_messages(text) from public, anon;
grant execute on function chercher_messages(text) to authenticated;

-- ------------------------------------------------------------
-- 12. Modifier un message dans les 5 minutes (texte seulement)
-- ------------------------------------------------------------
alter table messages add column if not exists modifie_le timestamptz;
grant update (texte, mentions, modifie_le) on messages to authenticated;
drop policy if exists messages_modification on messages;
create policy messages_modification on messages
  for update to authenticated
  using (auteur = auth.uid() and cree_le > now() - interval '5 minutes')
  with check (auteur = auth.uid());
create or replace function messages_avant_update() returns trigger
language plpgsql as $$
begin
  new.texte := btrim(new.texte);
  new.modifie_le := now();
  return new;
end $$;
drop trigger if exists messages_avant_update on messages;
create trigger messages_avant_update before update of texte on messages
  for each row execute function messages_avant_update();

-- ------------------------------------------------------------
-- 13. Contrôle de santé : les RPC que le navigateur a le droit d'appeler
-- ------------------------------------------------------------
insert into sante_fonctions_ouvertes (nom, raison) values
  ('message_dans_ma_conversation', 'messages : ce message est-il dans une de mes conversations ? (réactions)'),
  ('chercher_messages',            'messages : recherche dans mes conversations')
on conflict (nom) do nothing;

-- Vérifications (une instruction à la fois dans l'éditeur SQL) :
--   select column_name from information_schema.columns where table_name = 'messages' and column_name in ('fichier_chemin','reponse_a','modifie_le','fichier_expire_le');  -- 4
--   select policyname from pg_policies where tablename = 'objects' and policyname like 'pieces_%';  -- 3
--   select tablename from pg_publication_tables where pubname = 'supabase_realtime';  -- messages, conversation_membres, message_reactions
--   select jobname from cron.job where jobname in ('purge-messages', 'purge-pieces');  -- 2
--   select * from sante_systeme where verdict like 'PROBL%';   -- rien = tout va bien
