-- ============================================================
-- Migration 71 — la liste des questions renvoie la pièce jointe
--   (chemin + état d'expiration) pour afficher la photo en vignette dans le
--   Fil et la liste, pas seulement un trombone. Rejouable.
-- ============================================================
create or replace function liste_questions(p_filtre text default 'toutes', p_theme text default null,
                                           p_limite integer default 20, p_avant timestamptz default null,
                                           p_q text default null)
returns json language sql stable security invoker set search_path = public as $$
  select coalesce(json_agg(json_build_object(
    'id', q.id, 'titre', q.titre, 'details', left(q.details, 160), 'theme', q.theme, 'domaine', q.domaine,
    'anonyme', q.anonyme, 'resolue', q.resolue, 'fermee', q.fermee, 'masquee', q.masquee, 'cree_le', q.cree_le,
    'fichier_type', q.fichier_type, 'fichier_chemin', q.fichier_chemin, 'fichier_expiree', q.fichier_expiree,
    'auteur', auteur_question_json(q.auteur, q.anonyme),
    'nb_reponses', (select count(*) from reponses r where r.question_id = q.id and not r.masquee),
    'bravos', (select count(*) from reactions x where x.cible_type = 'question' and x.cible_id = q.id::text),
    'jai_bravo', exists (select 1 from reactions x where x.cible_type = 'question' and x.cible_id = q.id::text and x.membre = auth.uid())
  ) order by q.cree_le desc), '[]'::json)
  from (
    select * from questions q
    where (p_avant is null or q.cree_le < p_avant)
      and (p_theme is null or q.theme = p_theme)
      and (p_q is null or char_length(btrim(p_q)) < 2
           or q.titre ilike '%' || btrim(p_q) || '%' or q.details ilike '%' || btrim(p_q) || '%')
      and (p_filtre = 'toutes'
           or (p_filtre = 'sans_reponse' and not q.resolue and not exists (select 1 from reponses r where r.question_id = q.id and not r.masquee))
           or (p_filtre = 'resolues' and q.resolue)
           or (p_filtre = 'ouvertes' and not q.resolue)
           or (p_filtre = 'miennes' and q.auteur = auth.uid()))
    order by q.cree_le desc
    limit least(coalesce(p_limite, 20), 50)
  ) q
$$;

-- Vérification :
--   select liste_questions('toutes')->0 ? 'fichier_chemin';   -- true dès qu'il y a une question
