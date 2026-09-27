-- ============================================================
-- Migration 69 — temps réel sur le réseau social
--   Les tables du Fil, des questions, des événements, des moments et des
--   demandes de groupe rejoignent la publication « supabase_realtime » :
--   l'application se met à jour d'elle-même (compteurs, réponses,
--   participants, demandes) sans recharger. « replica identity full » pour
--   que les suppressions filtrées arrivent aussi (même leçon que la 58).
--   Les politiques de lecture s'appliquent au temps réel : chacun ne reçoit
--   que ce qu'il a le droit de lire. Rejouable.
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['publications', 'commentaires', 'reactions', 'questions', 'reponses',
                           'evenements', 'evenement_reponses', 'evenement_photos', 'groupe_demandes',
                           'moments', 'moment_reactions']
  loop
    execute format('alter table %I replica identity full', t);
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (select 1 from pg_publication_tables
                        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;

-- Vérification :
--   select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1;
--   -- doit lister, entre autres : commentaires, evenement_reponses, evenements, groupe_demandes,
--   --                            moments, publications, questions, reactions, reponses
