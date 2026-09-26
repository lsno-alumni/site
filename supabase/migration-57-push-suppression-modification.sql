-- ============================================================
-- Migration 57 — la notification suit le message
--   Un message SUPPRIMÉ referme la notification déjà affichée sur les
--   téléphones des autres (envoi « fermer » sur le même groupe de
--   notification) ; un message MODIFIÉ la met à jour sans faire vibrer
--   (envoi « silencieux »). Pour cela envoyer_push_liste accepte un
--   complément JSON transmis tel quel au service worker.
--   Rejouable.
-- ============================================================

-- envoi avec complément (7 paramètres) ; la version à 6 lui délègue
create or replace function envoyer_push_liste(
  p_profils uuid[], p_titre text, p_corps text, p_url text, p_famille text, p_groupe text, p_extra jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare
  cle    text;
  cibles uuid[];
  lot    uuid[];
  n      int;
begin
  if p_profils is null or array_length(p_profils, 1) is null then return; end if;
  select decrypted_secret into cle from vault.decrypted_secrets where name = 'push_secret';
  if cle is null then return; end if;
  if p_famille is null then
    select array_agg(distinct profil) into cibles from push_abonnements where profil = any(p_profils);
  else
    execute format($f$
      select array_agg(distinct a.profil)
        from push_abonnements a join profiles p on p.id = a.profil
       where a.profil = any($1) and coalesce(p.push_%I, true)
    $f$, p_famille) into cibles using p_profils;
  end if;
  while cibles is not null and array_length(cibles, 1) > 0 loop
    n := least(50, array_length(cibles, 1));
    lot := cibles[1:n];
    cibles := cibles[n + 1 : array_length(cibles, 1)];
    perform net.http_post(
      url     := 'https://lsno-alumni.vercel.app/api/push',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cle-push', cle),
      body    := jsonb_build_object('profils', to_jsonb(lot), 'titre', p_titre, 'corps', p_corps,
                                    'url', coalesce(p_url, '/'), 'famille', p_famille, 'groupe', p_groupe,
                                    'extra', coalesce(p_extra, '{}'::jsonb)));
  end loop;
exception when others then
  null;
end $$;
revoke all on function envoyer_push_liste(uuid[], text, text, text, text, text, jsonb) from public, anon, authenticated;

create or replace function envoyer_push_liste(
  p_profils uuid[], p_titre text, p_corps text, p_url text, p_famille text, p_groupe text
) returns void language plpgsql security definer set search_path = public as $$
begin
  perform envoyer_push_liste(p_profils, p_titre, p_corps, p_url, p_famille, p_groupe, '{}'::jsonb);
end $$;
revoke all on function envoyer_push_liste(uuid[], text, text, text, text, text) from public, anon, authenticated;

-- message supprimé → la notification de la conversation se referme chez les autres
create or replace function push_message_supprime() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cibles uuid[];
begin
  select array_agg(membre) into v_cibles from conversation_membres
   where conversation_id = old.conversation_id and membre <> old.auteur;
  if v_cibles is not null then
    perform envoyer_push_liste(v_cibles, 'Message supprimé', '', '/messages/' || old.conversation_id,
                               'messages', 'conv-' || old.conversation_id, '{"fermer": true}'::jsonb);
  end if;
  return old;
exception when others then
  return old;
end $$;
drop trigger if exists messages_apres_delete_push on messages;
create trigger messages_apres_delete_push after delete on messages
  for each row execute function push_message_supprime();

-- message modifié → la notification est remplacée, sans vibrer
create or replace function push_message_modifie() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_conv conversations%rowtype; v_qui text; v_cibles uuid[];
begin
  if new.texte = old.texte then return new; end if;
  select * into v_conv from conversations where id = new.conversation_id;
  select prenom || ' ' || nom into v_qui from profiles where id = new.auteur;
  select array_agg(membre) into v_cibles from conversation_membres
   where conversation_id = new.conversation_id and membre <> new.auteur and not muet
     and not est_bloque_entre(membre, new.auteur);
  if v_cibles is not null then
    perform envoyer_push_liste(v_cibles,
      case when v_conv.type = 'groupe' then coalesce(v_conv.nom, 'Groupe') else v_qui end,
      case when v_conv.type = 'groupe' then v_qui || ' : ' else '' end || left(new.texte, 100) || ' (modifié)',
      '/messages/' || new.conversation_id, 'messages', 'conv-' || new.conversation_id, '{"silencieux": true}'::jsonb);
  end if;
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists messages_apres_update_push on messages;
create trigger messages_apres_update_push after update of texte on messages
  for each row execute function push_message_modifie();

-- Vérification :
--   select proname, pronargs from pg_proc where proname = 'envoyer_push_liste';  -- 5, 6 et 7
