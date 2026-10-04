-- ============================================================
-- Migration 81 — retrait d'une photo du carrousel : le fichier par l'API
--   Supabase refuse désormais la suppression directe dans storage.objects
--   depuis une fonction SQL (« Direct deletion from storage tables is not
--   allowed. Use the Storage API instead. », code 42501 — constaté le 03/10
--   au premier retrait réel). carrousel_retirer() ne touche donc plus au
--   stockage : elle retire la ligne, journalise, et RENVOIE le chemin du
--   fichier ; l'appli le supprime ensuite par l'API Storage, que la politique
--   « carrousel_retrait » (migration 80) autorise aux délégués de la promo et
--   aux admins. Rejouable.
-- ============================================================
drop function if exists carrousel_retirer(int, int);
create or replace function carrousel_retirer(p_promotion int, p_position int) returns text
language plpgsql security definer set search_path = public as $$
declare v_chemin text; v_titre text; v_numero int;
begin
  if not peut_gerer_carrousel(p_promotion) then raise exception 'Réservé aux délégués de cette promotion et aux administrateurs.'; end if;
  select chemin, titre into v_chemin, v_titre from carrousel_photos where promotion_id = p_promotion and position = p_position;
  if v_chemin is null then return null; end if;
  delete from carrousel_photos where promotion_id = p_promotion and position = p_position;
  select numero into v_numero from promotions where id = p_promotion;
  perform journaliser('carrousel', null, jsonb_build_object('promo', v_numero, 'position', p_position, 'titre', v_titre, 'action', 'retrait'));
  return case when v_chemin like 'carrousel/%' then v_chemin else null end;   -- un fichier du site (/img/…) n'est pas à supprimer
end $$;
revoke all on function carrousel_retirer(int, int) from public, anon;
grant execute on function carrousel_retirer(int, int) to authenticated;

-- Vérification :  select pg_get_function_result('carrousel_retirer(int, int)'::regprocedure);   -- text
