-- ============================================================
-- Migration 09 — correctif de supprimer_mon_compte()
-- Supabase interdit le DELETE direct sur storage.objects depuis SQL
-- (« Direct deletion from storage tables is not allowed »). La photo
-- est donc supprimée côté client via l'API Storage AVANT l'appel ;
-- cette fonction ne s'occupe plus que du compte auth (profil +
-- parcours en cascade).
-- ============================================================

create or replace function supprimer_mon_compte()
returns void language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Aucun utilisateur connecté.';
  end if;
  delete from auth.users where id = uid;  -- profiles + parcours en cascade
end $$;

grant execute on function supprimer_mon_compte() to authenticated;
