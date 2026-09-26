-- ============================================================
-- Migration 60 — le bravo accepte les questions et les réponses
--   basculer_bravo() (migration 52) refusait toute cible autre que
--   publication, offre, conseil : « Cible inconnue. » sur une réponse.
--   Rejouable.
-- ============================================================
create or replace function basculer_bravo(p_type text, p_id text) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if mon_statut() <> 'valide' then raise exception 'Réservé aux membres validés.'; end if;
  if p_type not in ('publication', 'offre', 'conseil', 'question', 'reponse') then raise exception 'Cible inconnue.'; end if;
  if exists (select 1 from reactions where cible_type = p_type and cible_id = p_id and membre = auth.uid()) then
    delete from reactions where cible_type = p_type and cible_id = p_id and membre = auth.uid();
  else
    insert into reactions (cible_type, cible_id, membre) values (p_type, p_id, auth.uid());
  end if;
  select count(*) into n from reactions where cible_type = p_type and cible_id = p_id;
  return n;
end $$;
revoke all on function basculer_bravo(text, text) from public, anon;
grant execute on function basculer_bravo(text, text) to authenticated;

-- Vérification :
--   select prosrc like '%reponse%' from pg_proc where proname = 'basculer_bravo';
