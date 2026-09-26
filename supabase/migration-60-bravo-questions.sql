-- ============================================================
-- Migration 60 — questions et réponses : bravo et signalement
--   basculer_bravo() (migration 52) refusait toute cible autre que
--   publication, offre, conseil : « Cible inconnue. » sur une réponse.
--   Et la push de signalement disait « une offre » pour tout ce qui n'était
--   ni publication, ni commentaire, ni message (vu sur un vrai téléphone).
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

-- la push aux modérateurs nomme correctement une question ou une réponse signalée
create or replace function push_signalement() returns trigger
language plpgsql security definer set search_path = public as $$
declare cibles uuid[];
begin
  select array_agg(id) into cibles from profiles
   where statut_compte = 'valide' and role in ('delegue', 'admin') and id <> new.auteur;
  if cibles is not null then
    perform envoyer_push_liste(cibles, 'Un contenu a été signalé',
      'Un membre signale ' || case new.cible_type
        when 'publication' then 'une publication'
        when 'commentaire' then 'un commentaire'
        when 'message'     then 'un message'
        when 'question'    then 'une question aux anciens'
        when 'reponse'     then 'une réponse à une question'
        else 'une offre' end
      || ' : ' || left(new.motif, 100), '/admin', null);
  end if;
  return new;
end $$;

-- Vérifications :
--   select prosrc like '%reponse%' from pg_proc where proname = 'basculer_bravo';
--   select prosrc like '%une question aux anciens%' from pg_proc where proname = 'push_signalement';
