-- Nettoyage ponctuel (02/08) — retirer les espaces et retours à la ligne en
-- TROP au DÉBUT et à la FIN des conseils et des récits.
--
-- Pourquoi maintenant : les retours à la ligne des conseils sont désormais
-- AFFICHÉS. Une touche Entrée en trop à la fin, invisible jusqu'ici, creuse
-- depuis un vide au bas de la carte. L'application rogne déjà les extrémités à
-- l'enregistrement ; ceci rattrape les textes écrits avant.
--
-- ⚠ On ne touche QUE les extrémités. Les sauts de ligne À L'INTÉRIEUR sont la
-- mise en forme voulue par l'auteur : les supprimer serait réécrire son texte.
--
-- Ce n'est PAS une migration : aucune structure ne change, rien à rejouer sur
-- une base neuve. Rejouable sans risque (la deuxième exécution ne trouve rien).

-- ---------- 1. Avant : ce qui va être modifié ----------
select count(*) filter (where conseil  is distinct from btrim(conseil,  e' \t\r\n')) as conseils_a_nettoyer,
       count(*) filter (where histoire is distinct from btrim(histoire, e' \t\r\n')) as recits_a_nettoyer
from profiles;

-- ---------- 2. Le nettoyage ----------
-- btrim avec la liste explicite des caractères : sans elle, btrim ne retire que
-- les espaces ordinaires et laisserait justement les retours à la ligne.
-- Un texte qui ne contenait QUE des blancs devient null (comme dans l'app).
update profiles
   set conseil = nullif(btrim(conseil, e' \t\r\n'), '')
 where conseil is distinct from nullif(btrim(conseil, e' \t\r\n'), '');

update profiles
   set histoire = nullif(btrim(histoire, e' \t\r\n'), '')
 where histoire is distinct from nullif(btrim(histoire, e' \t\r\n'), '');

-- ---------- 3. Après : doit renvoyer 0 et 0 ----------
select count(*) filter (where conseil  is distinct from btrim(conseil,  e' \t\r\n')) as conseils_restants,
       count(*) filter (where histoire is distinct from btrim(histoire, e' \t\r\n')) as recits_restants
from profiles;

-- ---------- 4. Contrôle : les retours à la ligne INTERNES sont intacts ----------
-- Doit toujours afficher 4 (le comptage fait avant le nettoyage).
select count(*) filter (where conseil like '%' || chr(10) || '%') as conseils_avec_retours,
       count(*) as conseils_total
from profiles
where conseil is not null and conseil <> '';
