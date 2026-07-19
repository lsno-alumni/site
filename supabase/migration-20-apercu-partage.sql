-- ============================================================
-- Migration 20 — aperçu de partage des profils (décision produit :
-- nom, photo, promotion et « en une ligne » servent de vitrine
-- publique dans les aperçus WhatsApp/réseaux quand un membre
-- partage son profil. RIEN d'autre ne sort : contacts, parcours,
-- histoire, conseil restent derrière la connexion.)
-- ============================================================

create or replace function apercu_profil(cible uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'prenom', p.prenom,
    'nom', p.nom,
    'promo', (select numero from promotions where id = p.promotion_id),
    'statut', p.statut_titre,
    'photo', p.photo_url
  )
  from profiles p
  where p.id = cible and p.statut_compte = 'valide';
$$;

-- Vérification (facultatif, dans un onglet privé / sans session) :
--   select apercu_profil('<un-uuid-de-membre-valide>');
