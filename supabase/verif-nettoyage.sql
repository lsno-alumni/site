-- Contrôle du nettoyage des blancs (nettoyage-espaces-conseils.sql).
--
-- UNE seule instruction, volontairement : l'éditeur SQL de Supabase n'affiche
-- que le résultat de la DERNIÈRE, et les contrôles intermédiaires d'un script à
-- plusieurs requêtes passent donc inaperçus. Leçon du 02/08.
--
-- Attendu après le nettoyage :
--   conseils_a_nettoyer  = 0   ┐ plus rien à rogner
--   recits_a_nettoyer    = 0   ┘
--   conseils_avec_retours ≥ 4  → les sauts de ligne INTERNES sont intacts
--                                (4 au 02/08 ; le nombre monte quand un membre
--                                 écrit un conseil en paragraphes, il ne doit
--                                 jamais BAISSER du fait d'un nettoyage)

select
  count(*) filter (where conseil  is distinct from btrim(conseil,  e' \t\r\n')) as conseils_a_nettoyer,
  count(*) filter (where histoire is distinct from btrim(histoire, e' \t\r\n')) as recits_a_nettoyer,
  count(*) filter (where conseil like '%' || chr(10) || '%')                    as conseils_avec_retours,
  count(*) filter (where conseil is not null and conseil <> '')                 as conseils_total
from profiles;
