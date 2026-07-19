-- ============================================================
-- Migration 21 — aperçu de partage des OFFRES (même logique que
-- la migration 20 pour les profils) : quand un membre partage le
-- lien d'une offre, l'aperçu affiche titre, type, échéance, lieu.
-- Une offre est publiée POUR être diffusée — c'est sa vitrine.
-- Le posteur, lui, n'apparaît pas dans l'aperçu.
-- ============================================================

create or replace function apercu_offre(cible bigint) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'type', o.type,
    'titre', o.titre,
    'date_limite', o.date_limite,
    'ville', o.ville,
    'pays', o.pays
  )
  from offres o
  where o.id = cible and o.statut = 'active';
$$;

-- Vérification (facultatif) : select apercu_offre(1);
