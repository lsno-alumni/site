-- Migration 86 (05/10/2026) : la purge quotidienne des pièces jointes échouait depuis le 04/10.
-- Cause (journal de cron.job_run_details) : « new row for relation "messages" violates check
-- constraint "messages_texte_check" ». Un vocal (ou une photo envoyée sans texte) a un texte vide ;
-- quand sa pièce expire, purge_pieces() met fichier_chemin à null, et la règle « un message a un
-- texte OU une pièce OU un sondage » refuse la ligne. La boucle s'arrêtait au premier vocal expiré
-- et plus rien n'était purgé.
-- Correctif : la règle admet aussi une pièce EXPIRÉE (le message reste, l'écran affiche
-- « pièce jointe expirée »). Rien d'autre ne change ; la prochaine purge à 4 h 50 rattrape tout.

alter table messages drop constraint if exists messages_texte_check;
alter table messages add constraint messages_texte_check
  check (char_length(btrim(texte)) <= 2000
         and (char_length(btrim(texte)) >= 1 or fichier_chemin is not null or fichier_expiree or sondage_id is not null));

-- Vérification :
--   select purge_pieces();   -- doit renvoyer le nombre de pièces traitées, sans erreur
--   select count(*) from messages where fichier_expire_le < now() and not fichier_expiree and fichier_chemin is not null;   -- 0 après le passage
