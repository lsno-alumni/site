-- Essai au banc : le contrôle de santé après la migration 75.
--   npm run banc -- outils/banc/essai-sante.sql
-- Sur le banc, le Vault est une façade vide : les lignes « secrets ABSENT »
-- sont attendues ici et seulement ici. Tout le reste doit être « ok ».
select domaine, controle, constate, verdict
  from sante_systeme
 where verdict like 'PROBL%'
 order by domaine, controle;
