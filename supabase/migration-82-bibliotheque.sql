-- ============================================================
-- Migration 82 — la BIBLIOTHÈQUE : annales du bac, devoirs et compositions de
--                 l'école, cours, corrigés — proposés par les membres, modérés
--                 par les délégués et les admins
--   Suggestion d'un membre (03/10). Les FICHIERS ne sont pas stockés sur le
--   site : ils vivent sur le Google Drive de l'association (déposés par le
--   site via l'API Drive) ou derrière un lien externe ; la base ne garde que
--   la fiche (titre, matière, classe, année, type, lien) et son état :
--   en_attente → publie / refuse. Tout membre validé propose et lit (élèves
--   compris) ; un refus ou un retrait est journalisé ; les modérateurs sont
--   prévenus d'une proposition, l'auteur de la décision.
--
--   Conformité au contrôle de santé : AUCUN droit de table pour les clients
--   (quatre fonctions definer en liste blanche), RLS activée avec une
--   politique, clé uuid sans séquence. Rejouable. Se termine par ses GRANT.
-- ============================================================
create table if not exists bibliotheque (
  id           uuid primary key default gen_random_uuid(),
  titre        text not null check (char_length(btrim(titre)) between 3 and 120),
  type         text not null check (type in ('annale', 'devoir', 'cours', 'corrige', 'autre')),
  matiere      text not null check (char_length(btrim(matiere)) between 2 and 40),
  classe       text not null check (classe in ('seconde', 'premiere', 'terminale', 'bac')),
  annee        smallint not null check (annee between 1990 and 2100),
  serie        text check (serie is null or char_length(serie) <= 10),
  description  text check (description is null or char_length(description) <= 400),
  lien         text not null check (lien ~ '^https?://'),
  drive_id     text,                       -- fichier déposé par le site sur le Drive de l'association (null : lien externe)
  taille       integer check (taille is null or taille >= 0),
  propose_par  uuid,                       -- sans référence : la fiche survit au départ du membre
  propose_le   timestamptz not null default now(),
  statut       text not null default 'en_attente' check (statut in ('en_attente', 'publie', 'refuse')),
  modere_par   uuid,
  modere_le    timestamptz,
  motif_refus  text check (motif_refus is null or char_length(motif_refus) <= 300)
);
comment on table bibliotheque is 'Annales et sujets : fiches proposées par les membres (fichier sur le Drive de l''association ou lien), modérées par délégués/admins ; accès par bibliotheque_liste / proposer / moderer / supprimer';
create index if not exists bibliotheque_statut_idx on bibliotheque (statut, annee desc, propose_le desc);
alter table bibliotheque enable row level security;
drop policy if exists "bibliotheque_lecture_interne" on bibliotheque;
create policy "bibliotheque_lecture_interne" on bibliotheque for select to authenticated using (true);
revoke all on bibliotheque from public, anon, authenticated;

-- la liste : les fiches publiées pour tout membre validé ; « en_attente » et « refuse » pour les modérateurs
create or replace function bibliotheque_liste(p_statut text default 'publie') returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if mon_statut() is distinct from 'valide' then raise exception 'Réservé aux membres validés.'; end if;
  if p_statut <> 'publie' and not est_moderateur() then raise exception 'Réservé aux délégués et aux administrateurs.'; end if;
  return (select coalesce(json_agg(json_build_object(
      'id', b.id, 'titre', b.titre, 'type', b.type, 'matiere', b.matiere, 'classe', b.classe, 'annee', b.annee,
      'serie', b.serie, 'description', b.description, 'lien', b.lien, 'drive_id', b.drive_id, 'taille', b.taille,
      'statut', b.statut, 'propose_le', b.propose_le, 'modere_le', b.modere_le, 'motif_refus', b.motif_refus,
      'propose_par', b.propose_par,
      'auteur', (select json_build_object('prenom', p.prenom, 'nom', p.nom, 'promo', (select numero from promotions where id = p.promotion_id)) from profiles p where p.id = b.propose_par),
      'moderateur', (select p.prenom || ' ' || p.nom from profiles p where p.id = b.modere_par)
    ) order by case when p_statut = 'publie' then b.annee end desc, b.propose_le desc), '[]'::json)
    from bibliotheque b where b.statut = p_statut);
end $$;
revoke all on function bibliotheque_liste(text) from public, anon;
grant execute on function bibliotheque_liste(text) to authenticated;

-- proposer une fiche (fichier déjà déposé sur le Drive par le site, ou lien externe)
create or replace function bibliotheque_proposer(
  p_titre text, p_type text, p_matiere text, p_classe text, p_annee int, p_serie text,
  p_description text, p_lien text, p_drive_id text default null, p_taille int default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_moi uuid := auth.uid(); v_nom text; cibles uuid[];
begin
  if mon_statut() is distinct from 'valide' then raise exception 'Réservé aux membres validés.'; end if;
  insert into bibliotheque (titre, type, matiere, classe, annee, serie, description, lien, drive_id, taille, propose_par)
  values (btrim(p_titre), p_type, btrim(p_matiere), p_classe, p_annee, nullif(btrim(coalesce(p_serie, '')), ''),
          nullif(btrim(coalesce(p_description, '')), ''), btrim(p_lien), p_drive_id, p_taille, v_moi)
  returning id into v_id;
  -- les modérateurs sont prévenus (sauf l'auteur, s'il en est un)
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
revoke all on function bibliotheque_proposer(text, text, text, text, int, text, text, text, text, int) from public, anon;
grant execute on function bibliotheque_proposer(text, text, text, text, int, text, text, text, text, int) to authenticated;

-- publier ou refuser ; renvoie l'identifiant Drive du fichier à supprimer en cas de refus (sinon null)
create or replace function bibliotheque_moderer(p_id uuid, p_decision text, p_motif text default null) returns text
language plpgsql security definer set search_path = public as $$
declare b bibliotheque%rowtype;
begin
  if not est_moderateur() then raise exception 'Réservé aux délégués et aux administrateurs.'; end if;
  if p_decision not in ('publie', 'refuse') then raise exception 'Décision inconnue.'; end if;
  select * into b from bibliotheque where id = p_id;
  if b.id is null then raise exception 'Fiche introuvable.'; end if;
  update bibliotheque set statut = p_decision, modere_par = auth.uid(), modere_le = now(),
         motif_refus = case when p_decision = 'refuse' then nullif(btrim(coalesce(p_motif, '')), '') else null end
   where id = p_id;
  perform journaliser('bibliotheque', b.propose_par,
    jsonb_build_object('titre', b.titre, 'decision', p_decision, 'motif', nullif(btrim(coalesce(p_motif, '')), ''), 'matiere', b.matiere, 'annee', b.annee));
  if b.propose_par is not null and b.propose_par <> auth.uid() then
    perform envoyer_push_liste(array[b.propose_par],
      case when p_decision = 'publie' then 'Ton document est publié' else 'Ton document n''a pas été retenu' end,
      '« ' || left(b.titre, 80) || ' »' || case when p_decision = 'publie' then ' est maintenant dans la bibliothèque. Merci !'
                                               else coalesce(' : ' || left(btrim(p_motif), 160), '.') end,
      '/bibliotheque', null);
  end if;
  return case when p_decision = 'refuse' then b.drive_id else null end;
end $$;
revoke all on function bibliotheque_moderer(uuid, text, text) from public, anon;
grant execute on function bibliotheque_moderer(uuid, text, text) to authenticated;

-- retirer une fiche (publiée ou non) ; renvoie l'identifiant Drive du fichier à supprimer
create or replace function bibliotheque_supprimer(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare b bibliotheque%rowtype;
begin
  select * into b from bibliotheque where id = p_id;
  if b.id is null then return null; end if;
  -- l'auteur peut retirer sa propre proposition tant qu'elle attend ; sinon modérateur
  if not (est_moderateur() or (b.propose_par = auth.uid() and b.statut = 'en_attente')) then
    raise exception 'Réservé aux délégués et aux administrateurs.';
  end if;
  delete from bibliotheque where id = p_id;
  if est_moderateur() and b.propose_par is distinct from auth.uid() then
    perform journaliser('bibliotheque', b.propose_par, jsonb_build_object('titre', b.titre, 'decision', 'retrait', 'matiere', b.matiere, 'annee', b.annee));
  end if;
  return b.drive_id;
end $$;
revoke all on function bibliotheque_supprimer(uuid) from public, anon;
grant execute on function bibliotheque_supprimer(uuid) to authenticated;

insert into sante_fonctions_ouvertes (nom, raison) values
  ('bibliotheque_liste', 'bibliothèque : les fiches publiées (membres), en attente / refusées (modérateurs)'),
  ('bibliotheque_proposer', 'bibliothèque : un membre validé propose un document'),
  ('bibliotheque_moderer', 'bibliothèque : un délégué ou admin publie ou refuse'),
  ('bibliotheque_supprimer', 'bibliothèque : retrait d''une fiche (modérateur, ou auteur tant qu''elle attend)')
on conflict (nom) do nothing;

-- Vérification :  select json_array_length(bibliotheque_liste());   -- 0 au départ, sans erreur pour un membre validé
