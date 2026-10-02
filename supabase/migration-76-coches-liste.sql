-- ============================================================
-- Migration 76 — les coches « vu » dans la liste des conversations
--   Le dernier message de chaque conversation dit maintenant par combien
--   d'autres membres il a été lu (« lu_par ») sur combien (« autres »), pour
--   afficher dans l'onglet Messages, quand c'est MOI qui ai écrit en dernier :
--   une coche (envoyé), deux coches (lu par une partie du groupe), deux coches
--   bleues (lu par tous). Même règle que dans la conversation : lu = son
--   « lu_le » est postérieur à la date du message.
--   Réécrit mes_conversations() à l'identique hors ces deux champs. Rejouable.
--   La liste se recharge déjà en direct sur conversation_membres (lu_le).
-- ============================================================
create or replace function mes_conversations() returns json
language sql stable security invoker set search_path = public as $$
  select coalesce(json_agg(json_build_object(
    'id', c.id,
    'type', c.type,
    'nom', c.nom,
    'photo_url', c.photo_url,
    'description', c.description,
    'cree_par', c.cree_par,
    'dernier_message_le', c.dernier_message_le,
    'muet', moi.muet,
    'epingle', moi.epingle,
    'membres', (select json_agg(json_build_object('id', p.id, 'prenom', p.prenom, 'nom', p.nom, 'photo_url', p.photo_url) order by p.prenom)
                  from conversation_membres m join profiles p on p.id = m.membre
                 where m.conversation_id = c.id and m.membre <> auth.uid()),
    'nb_membres', (select count(*) from conversation_membres m where m.conversation_id = c.id),
    'dernier', (select json_build_object('texte', x.texte, 'auteur', x.auteur, 'prenom', a.prenom, 'cree_le', x.cree_le,
                                         'fichier_type', x.fichier_type, 'fichier_nom', x.fichier_nom,
                                         'sondage', (select question from sondages s where s.id = x.sondage_id),
                                         'autres', (select count(*) from conversation_membres m where m.conversation_id = c.id and m.membre <> x.auteur),
                                         'lu_par', (select count(*) from conversation_membres m where m.conversation_id = c.id and m.membre <> x.auteur and m.lu_le >= x.cree_le))
                  from messages x join profiles a on a.id = x.auteur
                 where x.conversation_id = c.id and not est_bloque_entre(auth.uid(), x.auteur)
                 order by x.cree_le desc limit 1),
    'non_lus', (select count(*) from messages x
                 where x.conversation_id = c.id and x.auteur <> auth.uid() and x.cree_le > moi.lu_le
                   and not est_bloque_entre(auth.uid(), x.auteur))
  ) order by moi.epingle desc, c.dernier_message_le desc nulls last, c.cree_le desc), '[]'::json)
  from conversations c
  join conversation_membres moi on moi.conversation_id = c.id and moi.membre = auth.uid()
$$;
grant execute on function mes_conversations() to authenticated;

-- Vérification :  select mes_conversations()->0->'dernier'->>'lu_par';   -- un nombre (ou null sans message)
