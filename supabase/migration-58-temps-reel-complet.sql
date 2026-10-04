-- ============================================================
-- Migration 58 — temps réel complet + marque « transféré »
--   Trouvé à l'usage : un message SUPPRIMÉ par l'autre ne disparaissait pas
--   d'une conversation ouverte. Cause : sans « replica identity full », un
--   événement de suppression ne porte que la clé primaire, et le filtre
--   « conversation_id = … » de l'abonnement ne peut pas le retenir.
--   Même logique pour la table conversations (renommage, photo, message
--   épinglé, suppression d'un groupe), qui n'était pas diffusée du tout.
--   Et un message transféré porte désormais une marque.
--   Rejouable.
-- ============================================================
alter table messages replica identity full;
alter table messages add column if not exists transfere boolean not null default false;

alter table conversations replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations') then
    alter publication supabase_realtime add table conversations;
  end if;
end $$;

-- Vérifications :
--   select relname, relreplident from pg_class where relname in ('messages', 'conversations', 'conversation_membres', 'message_reactions', 'sondage_votes');  -- tous « f »
--   select tablename from pg_publication_tables where pubname = 'supabase_realtime';  -- + conversations
