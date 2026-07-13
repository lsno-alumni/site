-- ============================================================
-- Migration 08 — suppression COMPLÈTE de son propre compte
-- Problème résolu : le client (clé publique) ne peut pas toucher
-- auth.users. Supprimer seulement la ligne profiles laissait le
-- compte auth actif → reconnexion possible sans profil (annuaire
-- vide, page profil qui plante).
--
-- Cette fonction SECURITY DEFINER s'exécute avec les droits du
-- propriétaire (accès au schéma auth). Elle supprime la ligne
-- auth.users de l'appelant ; profiles + parcours partent en cascade
-- (FK on delete cascade), ainsi que la photo dans le Storage.
-- ============================================================

create or replace function supprimer_mon_compte()
returns void language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Aucun utilisateur connecté.';
  end if;
  -- photo de profil (nommée <uuid>.jpg dans le bucket public « photos »)
  delete from storage.objects where bucket_id = 'photos' and name = uid || '.jpg';
  -- le compte auth : entraîne profiles puis parcours par cascade
  delete from auth.users where id = uid;
end $$;

grant execute on function supprimer_mon_compte() to authenticated;
