-- Migration 84 (04/10/2026) : « pour prendre la parole, dis qui tu es ».
-- Constat du 04/10 : 238 validés, 170 sans photo, 110 sans ligne de présentation, 96 sans lieu.
--
-- 1. profil_complet() : le minimum = photo, ville, pays, et une ligne de présentation
--    (sauf pour un élève). Le conseil aux cadets reste libre.
-- 2. Réciprocité, tenue par la base : toute prise de parole exige un profil complet —
--    publier (fil, moment), poser une question ou y répondre, créer un événement,
--    demander un contact, ouvrir une conversation ou un groupe, envoyer un message,
--    proposer un document. Lire, bravo et commentaires restent libres.
-- 3. Variante forte : les coordonnées des autres (contacts_de) ne sont rendues qu'à un
--    profil complet ; sinon la fonction renvoie {"verrou":"profil_incomplet"}.
-- 4. Relances : 3, 14 et 45 jours après la validation, tant que le profil est incomplet,
--    trois au maximum, 60 par jour, au moins 10 jours d'écart ; notification si un appareil
--    est enregistré (famille « le réseau »), sinon email. Branchées sur le cron quotidien
--    existant push-rappels-quotidiens (la liste des tâches du contrôle de santé ne change pas).

-- ---------- 1. le minimum ----------
create or replace function profil_complet(p_id uuid default auth.uid()) returns boolean
language sql stable set search_path = public as $$
  select coalesce((
    select nullif(btrim(coalesce(p.photo_url, '')), '') is not null
       and nullif(btrim(coalesce(p.ville, '')), '') is not null
       and nullif(btrim(coalesce(p.pays, '')), '') is not null
       and (coalesce(p.situation = 'eleve', false) or nullif(btrim(coalesce(p.statut_titre, '')), '') is not null)   -- situation est un enum : pas de comparaison à ''
    from profiles p where p.id = p_id), false);
$$;
revoke all on function profil_complet(uuid) from public, anon;
grant execute on function profil_complet(uuid) to authenticated;

-- ---------- 2. réciprocité dans les politiques d'écriture ----------
drop policy if exists publications_insertion on publications;
create policy publications_insertion on publications
  for insert to authenticated
  with check (mon_statut() = 'valide' and auteur = auth.uid() and profil_complet());

drop policy if exists moments_insertion on moments;
create policy moments_insertion on moments
  for insert to authenticated
  with check (mon_statut() = 'valide' and auteur = auth.uid() and profil_complet());

drop policy if exists questions_insertion on questions;
create policy questions_insertion on questions
  for insert to authenticated
  with check (mon_statut() = 'valide' and auteur = auth.uid() and profil_complet());

drop policy if exists reponses_insertion on reponses;
create policy reponses_insertion on reponses
  for insert to authenticated
  with check (mon_statut() = 'valide' and auteur = auth.uid() and profil_complet()
              and exists (select 1 from questions q where q.id = question_id and not q.masquee and not q.fermee));

drop policy if exists evenements_insertion on evenements;
create policy evenements_insertion on evenements
  for insert to authenticated
  with check (mon_statut() = 'valide' and organisateur = auth.uid() and profil_complet());

drop policy if exists dc_insertion on demandes_contact;
create policy dc_insertion on demandes_contact
  for insert to authenticated
  with check (
    demandeur = auth.uid()
    and statut = 'attente'
    and (select statut_compte from profiles where id = auth.uid()) = 'valide'
    and profil_complet()
  );

drop policy if exists messages_envoi on messages;
create policy messages_envoi on messages
  for insert to authenticated
  with check (mon_statut() = 'valide' and auteur = auth.uid() and profil_complet() and est_dans_conversation(conversation_id)
              and not exists (select 1 from conversation_membres m join conversations c on c.id = m.conversation_id
                               where m.conversation_id = messages.conversation_id and c.type = 'duo'
                                 and m.membre <> auth.uid() and est_bloque_entre(auth.uid(), m.membre)));

-- ouvrir une conversation ou un groupe (fonctions, pas politiques)
create or replace function ouvrir_duo(p_autre uuid) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if mon_statut() <> 'valide' then raise exception 'compte non validé'; end if;
  if not profil_complet() then raise exception 'profil_incomplet'; end if;
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

create or replace function creer_groupe(p_nom text, p_membres uuid[]) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if mon_statut() <> 'valide' then raise exception 'compte non validé'; end if;
  if not profil_complet() then raise exception 'profil_incomplet'; end if;
  if p_nom is null or char_length(btrim(p_nom)) = 0 then raise exception 'le groupe doit avoir un nom'; end if;
  insert into conversations (type, nom, cree_par) values ('groupe', btrim(p_nom), auth.uid()) returning id into v_id;
  insert into conversation_membres (conversation_id, membre)
  select v_id, id from profiles
   where statut_compte = 'valide' and (id = auth.uid() or id = any(coalesce(p_membres, '{}')))
  on conflict do nothing;
  return v_id;
end $$;

-- proposer un document (bibliothèque, migration 83 + la règle)
create or replace function bibliotheque_proposer(
  p_titre text, p_type text, p_matiere text, p_classe text, p_annee int, p_serie text,
  p_description text, p_lien text, p_drive_id text default null, p_taille int default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_moi uuid := auth.uid(); v_nom text; cibles uuid[]; v_direct boolean := est_moderateur();
begin
  if mon_statut() is distinct from 'valide' then raise exception 'Réservé aux membres validés.'; end if;
  if not profil_complet() then raise exception 'profil_incomplet'; end if;
  insert into bibliotheque (titre, type, matiere, classe, annee, serie, description, lien, drive_id, taille, propose_par,
                            statut, modere_par, modere_le)
  values (btrim(p_titre), p_type, btrim(p_matiere), p_classe, p_annee, nullif(btrim(coalesce(p_serie, '')), ''),
          nullif(btrim(coalesce(p_description, '')), ''), btrim(p_lien), p_drive_id, p_taille, v_moi,
          case when v_direct then 'publie' else 'en_attente' end,
          case when v_direct then v_moi end,
          case when v_direct then now() end)
  returning id into v_id;
  if v_direct then
    perform journaliser('bibliotheque', v_moi,
      jsonb_build_object('titre', btrim(p_titre), 'decision', 'publie', 'direct', true, 'matiere', btrim(p_matiere), 'annee', p_annee));
    return v_id;
  end if;
  select prenom into v_nom from profiles where id = v_moi;
  select array_agg(id) into cibles from profiles
   where statut_compte = 'valide' and role in ('delegue', 'admin') and id <> v_moi;
  if cibles is not null then
    perform envoyer_push_liste(cibles, 'Document proposé à la bibliothèque',
      coalesce(v_nom, 'Un membre') || ' propose « ' || left(btrim(p_titre), 80) || ' » (' || btrim(p_matiere) || ', ' || p_annee || ') — à relire.',
      '/admin#sec-bibliotheque', null);
  end if;
  return v_id;
end $$;

-- ---------- 3. les coordonnées des autres : donnant-donnant ----------
create or replace function contacts_de(cible uuid)
returns json language sql stable security definer set search_path = public as $$
  select case
    when (select statut_compte from profiles where id = auth.uid()) <> 'valide' then null
    when not profil_complet() then json_build_object('verrou', 'profil_incomplet')
    else (
      select json_build_object(
        'whatsapp', case when p.whatsapp_visi = 'membres'
                          or (p.whatsapp_visi = 'demande' and acc.ok) then p.whatsapp end,
        'email',    case when p.email_visi = 'membres'
                          or (p.email_visi = 'demande' and acc.ok) then p.email_contact end,
        'linkedin', case when p.linkedin_visi = 'membres'
                          or (p.linkedin_visi = 'demande' and acc.ok) then p.linkedin end,
        'visi', json_build_object(
          'whatsapp', p.whatsapp_visi, 'email', p.email_visi, 'linkedin', p.linkedin_visi),
        'acces_demande', acc.ok
      )
      from profiles p
      cross join lateral (
        select exists(
          select 1 from demandes_contact dc
          where dc.demandeur = auth.uid() and dc.cible = p.id and dc.statut = 'acceptee'
        ) as ok
      ) acc
      where p.id = contacts_de.cible and p.statut_compte = 'valide'
    )
  end;
$$;

-- ---------- 4. relances en trois temps ----------
alter table profiles
  add column if not exists relances_profil smallint not null default 0,
  add column if not exists relance_profil_le timestamptz;

create or replace function relancer_profils_incomplets() returns int
language plpgsql security definer set search_path = public as $$
declare
  v record; n int := 0; manque text; seuils int[] := array[3, 14, 45];
begin
  for v in
    select p.id, p.prenom, u.email, p.relances_profil, p.situation, p.photo_url, p.statut_titre, p.ville, p.pays
      from profiles p join auth.users u on u.id = p.id
     where p.statut_compte = 'valide'
       and p.relances_profil < 3
       and not profil_complet(p.id)
       and coalesce(p.valide_le, p.cree_le) < now() - make_interval(days => seuils[p.relances_profil + 1])
       and (p.relance_profil_le is null or p.relance_profil_le < now() - interval '10 days')
     order by p.relance_profil_le nulls first, coalesce(p.valide_le, p.cree_le)
     limit 60
  loop
    manque := array_to_string(array_remove(array[
      case when nullif(btrim(coalesce(v.photo_url, '')), '') is null then 'ta photo' end,
      case when coalesce(v.situation <> 'eleve', true) and nullif(btrim(coalesce(v.statut_titre, '')), '') is null then 'une ligne de présentation' end,
      case when nullif(btrim(coalesce(v.ville, '')), '') is null then 'ta ville' end,
      case when nullif(btrim(coalesce(v.pays, '')), '') is null then 'ton pays' end
    ], null), ', ');
    begin   -- un transport qui échoue ne bloque ni la boucle ni le compteur
      if exists (select 1 from push_abonnements a where a.profil = v.id) then
        perform envoyer_push_liste(array[v.id], 'Dis aux anciens qui tu es',
          'Il manque ' || manque || ' sur ton profil. Une minute suffit — et c''est la clé pour écrire aux anciens et voir leurs coordonnées.',
          '/mon-profil', 'reseau', null, null);
      else
        perform envoyer_email(v.email, v.prenom, 'Ton profil LSNO Amicale attend ' || manque,
          gabarit_email('Dis aux anciens qui tu es',
            'Bonjour ' || coalesce(v.prenom, '') || ', il manque encore ' || manque || ' sur ton profil. '
            || 'Sans cela, tu ne peux pas écrire aux anciens ni voir leurs coordonnées : c''est le donnant-donnant du réseau. '
            || 'Une minute suffit.',
            'Compléter mon profil', 'https://lsno-alumni.vercel.app/mon-profil'));
      end if;
    exception when others then null;
    end;
    update profiles set relances_profil = relances_profil + 1, relance_profil_le = now() where id = v.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function relancer_profils_incomplets() from public, anon, authenticated;

-- même nom de tâche : pg_cron remplace la commande, le contrôle de santé n'y voit aucun changement
select cron.schedule('push-rappels-quotidiens', '0 9 * * *', $$select push_rappels_quotidiens(); select relancer_profils_incomplets();$$);

-- ---------- droits (règle du 01/08 : toute migration à DDL finit par ses GRANT explicites) ----------
grant select, insert, update, delete on profiles to authenticated;

-- Vérification :
--   select profil_complet();                                   -- true/false pour ton compte
--   select count(*) from profiles where statut_compte = 'valide' and not profil_complet(id);   -- les incomplets
--   select command from cron.job where jobname = 'push-rappels-quotidiens';   -- doit contenir relancer_profils_incomplets
