-- Migration 37 — le sort d'une demande REFUSÉE, et un garde-fou sur la purge.
--
-- Constat de départ : refuser une demande met le compte à « suspendu » (il
-- n'existe pas de statut « refusé »). Trois conséquences, toutes mauvaises :
--   • le compte n'est JAMAIS purgé — son email est confirmé, donc la purge des
--     comptes fantômes ne le voit pas — et son adresse reste prise à vie ;
--   • il est indiscernable d'un membre sanctionné ;
--   • le site lui MENT : l'annuaire lui affiche « ton délégué examine ta
--     demande, en général sous 24 h », pour une réponse déjà donnée.
--
-- Choix : une COLONNE refuse_le, pas une valeur de plus dans l'énumération
-- statut_compte. Cette énumération est comparée dans les règles de sécurité de
-- la base ; y ajouter une valeur obligerait à auditer chaque comparaison, pour
-- un bénéfice nul ici.
--
-- Le journal (migration 36) distingue déjà « refus » de « suspension » : la
-- traçabilité existe même avant cette migration, et elle survit 12 mois — donc
-- purger le compte refusé ne fait perdre aucune responsabilité.
--
-- Rejouable.

-- ---------- ① la marque du refus ----------
alter table profiles add column if not exists refuse_le timestamptz;

comment on column profiles.refuse_le is
  'Horodatage du refus d''une demande d''inscription (statut passé de en_attente à suspendu). Remis à NULL si le compte est finalement validé. Sert au message affiché à la personne et à la purge des refus anciens.';

-- ---------- ② posée par le déclencheur existant ----------
-- protege_colonnes() est déjà le BEFORE UPDATE qui surveille statut et rôle :
-- c'est l'endroit naturel. Corps identique à la version de la migration 34,
-- avec la marque du refus ajoutée.
create or replace function protege_colonnes() returns trigger
language plpgsql security definer as $$
begin
  if (new.statut_compte is distinct from old.statut_compte
      or new.role is distinct from old.role) then
    if mon_role() not in ('delegue', 'admin') then
      raise exception 'Seuls les délégués et administrateurs peuvent modifier statut ou rôle.';
    end if;
    -- un délégué ne promeut pas au-delà de membre<->valide ; seuls les admins gèrent les rôles
    if new.role is distinct from old.role and mon_role() <> 'admin' then
      raise exception 'Seuls les administrateurs peuvent modifier les rôles.';
    end if;
  end if;

  -- Horodatage de la validation : seulement au passage à « validé », jamais sur
  -- un changement de rôle — sinon un délégué promu réapparaît dans « Ils viennent
  -- d'arriver » et l'auteur réel de sa validation est écrasé (migration 34).
  if new.statut_compte is distinct from old.statut_compte
     and new.statut_compte = 'valide' then
    new.valide_par := auth.uid();
    new.valide_le  := now();
    new.refuse_le  := null;          -- un refus revu efface sa marque
  end if;

  -- Refus d'inscription : en attente -> suspendu (migration 37)
  if old.statut_compte = 'en_attente' and new.statut_compte = 'suspendu' then
    new.refuse_le := now();
  end if;

  new.maj_le := now();
  return new;
end $$;

-- ---------- ③ garde-fou sur la purge des comptes fantômes ----------
-- La purge ne regardait QUE email_confirmed_at. Or un délégué peut valider
-- quelqu'un qui n'a jamais confirmé son email : ce membre recevait son message
-- de bienvenue puis disparaissait 30 jours plus tard, sans explication.
-- Désormais un compte validé par un humain n'est jamais supprimé par la machine.
create or replace function purge_comptes_non_confirmes()
returns void language plpgsql security definer
set search_path = public, auth as $$
begin
  delete from auth.users u
  where u.email_confirmed_at is null
    and u.created_at < now() - interval '30 days'
    and not exists (
      select 1 from profiles p where p.id = u.id and p.statut_compte = 'valide'
    );
end $$;

-- ---------- ④ purge des refus au-delà de 90 jours ----------
-- 90 jours : assez long pour revenir sur une erreur de délégué, assez court pour
-- que l'adresse email finisse par être libérée (la personne peut se réinscrire).
-- Le journal garde la trace du refus 12 mois, indépendamment du compte.
create or replace function purge_refus_anciens()
returns void language plpgsql security definer
set search_path = public, auth as $$
begin
  delete from auth.users u
  using profiles p
  where p.id = u.id
    and p.statut_compte = 'suspendu'
    and p.refuse_le is not null
    and p.refuse_le < now() - interval '90 days';
end $$;

revoke all on function purge_refus_anciens() from public, anon, authenticated;

-- 1er du mois à 5h15, entre la purge des fantômes (5h) et la clôture des offres (5h30)
select cron.schedule('purge-refus', '15 5 1 * *', $$select purge_refus_anciens();$$);

-- Vérification :
--   select jobname from cron.job order by jobname;   -- 15 jobs attendus
--   select prenom, nom, refuse_le from profiles where refuse_le is not null;
