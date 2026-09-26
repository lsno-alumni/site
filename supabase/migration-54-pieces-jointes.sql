-- ============================================================
-- Migration 54 — PIÈCES JOINTES dans les messages
--   Une photo (réduite sur le téléphone), une vidéo (30 s, 20 Mo) ou un PDF
--   (10 Mo) par message, avec ou sans texte. Rangées dans un bucket PRIVÉ
--   « pieces » : chemin « <conversation>/<uuid-auteur>/<horodatage>.<ext> »,
--   lecture réservée aux membres de la conversation (URL signées côté app).
--   Un message supprimé (à la main, par la purge à 30 jours, ou avec son
--   groupe) emporte son fichier.
--   ⚠ AVANT d'exécuter : créer le bucket Storage « pieces », PRIVÉ, 20 Mo,
--     types image/*, video/*, application/pdf.
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

-- Vérifications (une instruction à la fois dans l'éditeur SQL) :
--   select column_name from information_schema.columns where table_name = 'messages' and column_name like 'fichier%';  -- 4
--   select policyname from pg_policies where tablename = 'objects' and policyname like 'pieces_%';  -- 3
--   select * from sante_systeme where verdict like 'PROBL%';   -- rien = tout va bien
