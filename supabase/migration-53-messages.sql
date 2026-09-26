-- ============================================================
-- Migration 53 — MESSAGES (chantier « réseau social », brique 2)
--   Conversations à deux (« duo ») et groupes, ouvertes à tous les membres
--   validés. Les MESSAGES s'effacent au bout de 30 jours (tâche quotidienne),
--   les conversations et les groupes restent. Un groupe se supprime à la
--   main (son créateur ou un admin). Temps réel via Supabase Realtime sur
--   la table messages (la RLS filtre ce que chacun reçoit). Notification
--   push aux autres membres À CHAQUE message (sur l'appareil, les messages
--   d'une même conversation remplacent la notification précédente au lieu
--   de s'empiler ; rien n'est affiché si la conversation est ouverte à
--   l'écran) et quand on est ajouté à un groupe — famille « messages »
--   (nouvel interrupteur dans Mon profil).
--   LE FIL, tout ce qui le fait vivre (section 6c) :
--     - nouvelle publication → les membres de son cercle (famille « fil »,
--       regroupées sur l'appareil au-delà de 4 : « 5 nouvelles publications »)
--     - bravo sur ma publication / mon offre / mon conseil → moi
--     - commentaire là où j'ai déjà commenté → « X a aussi commenté »
--     - ma publication ou mon commentaire masqué par la modération → moi
--   (le commentaire sur MA publication et la réponse à MON commentaire
--    existaient déjà : migration 52)
--   MENTIONS « @Prénom Nom » (section 6d) dans les publications, les
--   commentaires et les messages : lien vers le profil + notification.
--   Rejouable. Se termine par ses GRANT explicites (CONTRIBUTING § Pièges).
-- ============================================================

-- ------------------------------------------------------------
-- 0. Préférence push « messages »
-- ------------------------------------------------------------
alter table profiles add column if not exists push_messages boolean not null default true;
alter table profiles add column if not exists push_fil      boolean not null default true;
grant select (push_messages, push_fil) on profiles to authenticated;
grant update (push_messages, push_fil) on profiles to authenticated;

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
-- 6a. Envoi push avec « groupe » : sur l'appareil, deux notifications du
--     même groupe se REMPLACENT (une seule vignette par conversation, mise à
--     jour au dernier message) au lieu de s'empiler. Variante à 6 paramètres
--     de envoyer_push_liste (migration 33) ; la version à 5 lui délègue.
-- ------------------------------------------------------------
create or replace function envoyer_push_liste(
  p_profils uuid[], p_titre text, p_corps text, p_url text, p_famille text, p_groupe text
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
                                    'url', coalesce(p_url, '/'), 'famille', p_famille, 'groupe', p_groupe));
  end loop;
exception when others then
  null;  -- une notification ne doit jamais faire échouer l'action d'origine
end $$;
revoke all on function envoyer_push_liste(uuid[], text, text, text, text, text) from public, anon, authenticated;

create or replace function envoyer_push_liste(
  p_profils uuid[], p_titre text, p_corps text, p_url text default '/', p_famille text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  perform envoyer_push_liste(p_profils, p_titre, p_corps, p_url, p_famille, null::text);
end $$;
revoke all on function envoyer_push_liste(uuid[], text, text, text, text) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 6b. À chaque message : horodatage de la conversation, l'auteur est réputé
--     avoir lu jusqu'ici, et push aux AUTRES membres (groupe « conv-<id> »)
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
     and not (membre = any(coalesce(new.mentions, '{}')));   -- les mentionnés reçoivent la mention
  if v_cibles is not null then
    perform envoyer_push_liste(v_cibles, v_titre,
      case when v_conv.type = 'groupe' then v_qui || ' : ' else '' end || left(new.texte, 100),
      '/messages/' || new.conversation_id, 'messages', 'conv-' || new.conversation_id);
  end if;
  return new;
end $$;
drop trigger if exists messages_apres_insert on messages;
create trigger messages_apres_insert after insert on messages
  for each row execute function apres_message();

-- ajouté à un groupe par quelqu'un d'autre → « Ana t'a ajouté au groupe … »
create or replace function apres_ajout_membre() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_conv conversations%rowtype; v_qui text;
begin
  select * into v_conv from conversations where id = new.conversation_id;
  if v_conv.type = 'groupe' and auth.uid() is not null and new.membre <> auth.uid() then
    select prenom || ' ' || nom into v_qui from profiles where id = auth.uid();
    perform envoyer_push_liste(array[new.membre], coalesce(v_conv.nom, 'Nouveau groupe'),
      coalesce(v_qui, 'Un membre') || ' t''a ajouté au groupe',
      '/messages/' || new.conversation_id, 'messages', 'conv-' || new.conversation_id);
  end if;
  return new;
end $$;
drop trigger if exists membres_apres_insert on conversation_membres;
create trigger membres_apres_insert after insert on conversation_membres
  for each row execute function apres_ajout_membre();

-- ------------------------------------------------------------
-- 6c. LE FIL : ce qui le fait vivre
-- ------------------------------------------------------------
-- nouvelle publication → les membres validés de son cercle (famille « fil »)
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
      coalesce(nullif(left(new.texte, 100), ''), case new.media_type when 'video' then 'Une vidéo' else 'Une photo' end),
      '/publication/' || new.id, 'fil', 'pub-' || new.id);
  end if;
  return new;
end $$;
drop trigger if exists publications_push on publications;
create trigger publications_push after insert on publications
  for each row execute function push_publication();

-- bravo sur MA publication, MON offre ou MON conseil → moi (les bravos
-- successifs sur la même cible remplacent la vignette précédente)
create or replace function push_bravo() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_auteur uuid; v_qui text; v_texte text; v_quoi text; v_url text;
begin
  if new.cible_type = 'publication' then
    select auteur, coalesce(nullif(left(texte, 100), ''), 'Ta photo ou ta vidéo') into v_auteur, v_texte
      from publications where id = new.cible_id::bigint;
    v_quoi := 'ta publication'; v_url := '/publication/' || new.cible_id;
  elsif new.cible_type = 'offre' then
    select posteur, left(titre, 100) into v_auteur, v_texte from offres where id = new.cible_id::bigint;
    v_quoi := 'ton offre'; v_url := '/offres/' || new.cible_id;
  else
    select id, left(conseil, 100) into v_auteur, v_texte from profiles where id = new.cible_id::uuid;
    v_quoi := 'ton conseil aux cadets'; v_url := '/profil/' || new.cible_id;
  end if;
  if v_auteur is null or v_auteur = new.membre then return new; end if;
  select prenom || ' ' || nom into v_qui from profiles where id = new.membre;
  perform envoyer_push_liste(array[v_auteur], v_qui || ' a applaudi ' || v_quoi, coalesce(v_texte, ''),
    v_url, 'mes_demandes', 'bravo-' || new.cible_type || '-' || new.cible_id);
  return new;
end $$;
drop trigger if exists reactions_push on reactions;
create trigger reactions_push after insert on reactions
  for each row execute function push_bravo();

-- commentaire : en plus de l'auteur de la publication / de l'offre et de la
-- personne à qui l'on répond (migration 52), les AUTRES qui ont déjà
-- commenté là sont prévenus (famille « fil », une vignette par discussion)
create or replace function push_commentaire_participants() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_qui text; v_proprio uuid; v_nom_proprio text; v_repond uuid; cibles uuid[]; v_url text;
begin
  select prenom || ' ' || nom into v_qui from profiles where id = new.auteur;
  if new.cible_type = 'publication' then
    select auteur into v_proprio from publications where id = new.cible_id::bigint;
    v_url := '/publication/' || new.cible_id;
  else
    select posteur into v_proprio from offres where id = new.cible_id::bigint;
    v_url := '/offres/' || new.cible_id;
  end if;
  if new.reponse_a is not null then select auteur into v_repond from commentaires where id = new.reponse_a; end if;
  select prenom into v_nom_proprio from profiles where id = v_proprio;
  select array_agg(distinct auteur) into cibles from commentaires
   where cible_type = new.cible_type and cible_id = new.cible_id and not masque
     and auteur <> new.auteur and auteur is distinct from v_proprio and auteur is distinct from v_repond
     and not (auteur = any(coalesce(new.mentions, '{}')));
  if cibles is not null then
    perform envoyer_push_liste(cibles,
      v_qui || ' a aussi commenté ' || case when new.cible_type = 'publication' then 'la publication' else 'l''offre' end
        || case when v_nom_proprio is not null then ' de ' || v_nom_proprio else '' end,
      left(new.texte, 100), v_url, 'fil', 'com-' || new.cible_type || '-' || new.cible_id);
  end if;
  return new;
end $$;
drop trigger if exists commentaires_push_participants on commentaires;
create trigger commentaires_push_participants after insert on commentaires
  for each row execute function push_commentaire_participants();

-- masqué par la modération → l'auteur est prévenu (transparence)
create or replace function push_masquage() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'publications' then
    if new.masquee and not old.masquee then
      perform envoyer_push(new.auteur, 'Ta publication a été masquée',
        'La modération l''a retirée de la vue des autres membres. Écris à un délégué pour en parler.',
        '/publication/' || new.id, 'mes_demandes');
    end if;
  else
    if new.masque and not old.masque then
      perform envoyer_push(new.auteur, 'Ton commentaire a été masqué',
        'La modération l''a retiré de la vue des autres membres.',
        case when new.cible_type = 'publication' then '/publication/' else '/offres/' end || new.cible_id, 'mes_demandes');
    end if;
  end if;
  return new;
end $$;
drop trigger if exists publications_push_masquage on publications;
create trigger publications_push_masquage after update of masquee on publications
  for each row execute function push_masquage();
drop trigger if exists commentaires_push_masquage on commentaires;
create trigger commentaires_push_masquage after update of masque on commentaires
  for each row execute function push_masquage();

-- le texte est nettoyé à l'entrée
create or replace function messages_avant_insert() returns trigger
language plpgsql as $$
begin new.texte := btrim(new.texte); return new; end $$;
drop trigger if exists messages_avant_insert on messages;
create trigger messages_avant_insert before insert on messages
  for each row execute function messages_avant_insert();


-- ------------------------------------------------------------
-- 6d. MENTIONS « @Prénom Nom » — dans une publication, un commentaire, un
--     message. Le texte garde « @Prénom Nom » tel quel ; la colonne
--     `mentions` (uuid[]) dit QUI, ce qui rend le lien vers le profil et la
--     notification fiables même en cas d'homonymes. La personne mentionnée
--     reçoit « Ana t'a mentionné dans … » (famille « mes_demandes »), sauf
--     si elle est déjà prévenue autrement pour ce même contenu.
-- ------------------------------------------------------------
alter table publications add column if not exists mentions uuid[] not null default '{}';
alter table commentaires add column if not exists mentions uuid[] not null default '{}';
alter table messages     add column if not exists mentions uuid[] not null default '{}';

-- les lectures du fil et des commentaires portent les personnes mentionnées
-- (id, prénom, nom) — mêmes fonctions que la migration 52, enrichies
create or replace function fil_publications(p_limite integer default 20, p_avant timestamptz default null)
returns json language sql stable security invoker set search_path = public as $$
  select coalesce(json_agg(json_build_object(
    'id', p.id,
    'texte', p.texte,
    'media_chemin', p.media_chemin,
    'media_type', p.media_type,
    'media_expire_le', p.media_expire_le,
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

create or replace function commentaires_de(p_type text, p_id text) returns json
language sql stable security invoker set search_path = public as $$
  select coalesce(json_agg(json_build_object(
    'id', c.id, 'texte', c.texte, 'reponse_a', c.reponse_a, 'masque', c.masque, 'cree_le', c.cree_le,
    'auteur', json_build_object('id', a.id, 'prenom', a.prenom, 'nom', a.nom, 'photo_url', a.photo_url,
                                'promo', (select numero from promotions where id = a.promotion_id)),
    'mentions', (select coalesce(json_agg(json_build_object('id', m.id, 'prenom', m.prenom, 'nom', m.nom)), '[]'::json)
                   from profiles m where m.id = any(c.mentions))
  ) order by c.cree_le), '[]'::json)
  from commentaires c join profiles a on a.id = c.auteur
  where c.cible_type = p_type and c.cible_id = p_id
$$;

-- la notification (une fonction pour les trois tables)
create or replace function push_mentions() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_qui text; v_promo int; v_domaine text; v_url text; v_ou text; cibles uuid[];
begin
  if new.mentions is null or array_length(new.mentions, 1) is null then return new; end if;
  select prenom || ' ' || nom, promotion_id, domaine into v_qui, v_promo, v_domaine from profiles where id = new.auteur;
  if tg_table_name = 'publications' then
    v_url := '/publication/' || new.id; v_ou := 'dans une publication';
    -- seulement ceux qui ont le droit de la voir (cercle de visibilité)
    select array_agg(p.id) into cibles from profiles p
     where p.id = any(new.mentions) and p.id <> new.auteur and p.statut_compte = 'valide'
       and (new.visibilite = 'tous'
            or (new.visibilite = 'promo'   and p.promotion_id = v_promo)
            or (new.visibilite = 'domaine' and p.domaine = v_domaine));
  elsif tg_table_name = 'commentaires' then
    v_url := case when new.cible_type = 'publication' then '/publication/' else '/offres/' end || new.cible_id;
    v_ou := 'dans un commentaire';
    -- l'auteur de la cible et la personne à qui l'on répond sont déjà prévenus
    select array_agg(p.id) into cibles from profiles p
     where p.id = any(new.mentions) and p.id <> new.auteur and p.statut_compte = 'valide'
       and p.id is distinct from (case when new.cible_type = 'publication'
                                       then (select auteur from publications where id = new.cible_id::bigint)
                                       else (select posteur from offres where id = new.cible_id::bigint) end)
       and p.id is distinct from (select auteur from commentaires where id = new.reponse_a);
  else
    v_url := '/messages/' || new.conversation_id; v_ou := 'dans une conversation';
    -- seulement les membres de la conversation
    select array_agg(m.membre) into cibles from conversation_membres m
     where m.conversation_id = new.conversation_id and m.membre = any(new.mentions) and m.membre <> new.auteur;
  end if;
  if cibles is not null then
    perform envoyer_push_liste(cibles, v_qui || ' t''a mentionné ' || v_ou, left(new.texte, 100),
      v_url, 'mes_demandes', 'mention-' || tg_table_name || '-' || new.id);
  end if;
  return new;
end $$;
drop trigger if exists publications_push_mentions on publications;
create trigger publications_push_mentions after insert on publications
  for each row execute function push_mentions();
drop trigger if exists commentaires_push_mentions on commentaires;
create trigger commentaires_push_mentions after insert on commentaires
  for each row execute function push_mentions();
drop trigger if exists messages_push_mentions on messages;
create trigger messages_push_mentions after insert on messages
  for each row execute function push_mentions();

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
