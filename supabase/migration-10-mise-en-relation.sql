-- ============================================================
-- Migration 10 — V2.1 : MISE EN RELATION (« sur demande » devient réel)
--   A demande le contact de B (+ message optionnel)
--   -> email à B, qui accepte/refuse depuis Mon profil
--   -> si accepté : email à A, et les contacts « sur demande » de B
--      se déverrouillent pour A (au niveau de la base)
--   Une seule demande possible par paire (anti-harcèlement) ; pas
--   d'email au demandeur en cas de refus.
-- ============================================================

create type statut_demande as enum ('attente', 'acceptee', 'refusee');

create table demandes_contact (
  id         bigserial primary key,
  demandeur  uuid not null references profiles(id) on delete cascade,
  cible      uuid not null references profiles(id) on delete cascade,
  message    text check (char_length(message) <= 300),
  statut     statut_demande not null default 'attente',
  cree_le    timestamptz not null default now(),
  traite_le  timestamptz,
  unique (demandeur, cible),
  check (demandeur <> cible)
);

grant select, insert, update on demandes_contact to authenticated;
grant usage, select on sequence demandes_contact_id_seq to authenticated;

alter table demandes_contact enable row level security;

-- créer : uniquement en son propre nom, compte validé, statut attente
create policy dc_insertion on demandes_contact
  for insert to authenticated
  with check (
    demandeur = auth.uid()
    and statut = 'attente'
    and (select statut_compte from profiles where id = auth.uid()) = 'valide'
  );

-- lire : ses demandes envoyées et reçues
create policy dc_lecture on demandes_contact
  for select to authenticated
  using (demandeur = auth.uid() or cible = auth.uid());

-- traiter : seul le destinataire change le statut
create policy dc_traitement on demandes_contact
  for update to authenticated
  using (cible = auth.uid())
  with check (cible = auth.uid());

-- horodatage du traitement
create or replace function dc_horodate() returns trigger
language plpgsql as $$
begin
  if new.statut is distinct from old.statut then
    new.traite_le := now();
  end if;
  return new;
end $$;
create trigger demandes_contact_horodate
  before update on demandes_contact
  for each row execute function dc_horodate();

-- ---------- déverrouillage : contacts_de() tient compte des demandes acceptées ----------
create or replace function contacts_de(cible uuid)
returns json language sql stable security definer set search_path = public as $$
  select case
    when (select statut_compte from profiles where id = auth.uid()) <> 'valide' then null
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

-- ---------- emails ----------
-- nouvelle demande -> email au destinataire
create or replace function notifie_demande_contact() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_prenom_cible text;
  v_demandeur record;
begin
  select email into v_email from auth.users where id = new.cible;
  select prenom into v_prenom_cible from profiles where id = new.cible;
  select p.prenom, p.nom, pr.numero as promo into v_demandeur
    from profiles p join promotions pr on pr.id = p.promotion_id
    where p.id = new.demandeur;
  perform envoyer_email(
    v_email, v_prenom_cible,
    v_demandeur.prenom || ' ' || v_demandeur.nom || ' souhaite te contacter',
    gabarit_email(
      'Demande de mise en relation',
      '<b>' || v_demandeur.prenom || ' ' || v_demandeur.nom || '</b> (promo ' || v_demandeur.promo ||
      ') souhaite obtenir tes coordonnées « sur demande ».'
      || coalesce('<br><br><i>« ' || new.message || ' »</i>', '')
      || '<br><br>Tu peux accepter ou refuser — en cas de refus, il n''en sera pas informé.',
      'Répondre à la demande',
      'https://lsno-alumni.vercel.app/mon-profil'));
  return new;
end $$;
create trigger demandes_contact_notifie
  after insert on demandes_contact
  for each row execute function notifie_demande_contact();

-- demande acceptée -> email au demandeur (rien en cas de refus)
create or replace function notifie_demande_acceptee() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_prenom_demandeur text;
  v_cible record;
begin
  if old.statut = 'attente' and new.statut = 'acceptee' then
    select email into v_email from auth.users where id = new.demandeur;
    select prenom into v_prenom_demandeur from profiles where id = new.demandeur;
    select p.prenom, p.nom, p.id into v_cible from profiles p where p.id = new.cible;
    perform envoyer_email(
      v_email, v_prenom_demandeur,
      v_cible.prenom || ' ' || v_cible.nom || ' a accepté ta demande',
      gabarit_email(
        'Mise en relation acceptée',
        '<b>' || v_cible.prenom || ' ' || v_cible.nom || '</b> a accepté ta demande : '
        || 'ses coordonnées te sont maintenant ouvertes sur son profil.',
        'Voir son profil',
        'https://lsno-alumni.vercel.app/profil/' || v_cible.id));
  end if;
  return new;
end $$;
create trigger demandes_contact_notifie_acceptation
  after update on demandes_contact
  for each row execute function notifie_demande_acceptee();
