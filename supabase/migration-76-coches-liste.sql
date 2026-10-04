-- ============================================================
-- Migration 76 — coches « parti / reçu / lu » comme sur WhatsApp
--   Une coche : le message est parti. Deux coches grises : tous les autres
--   membres l'ont REÇU (leur appli l'a eu en main : en direct, ou à l'ouverture,
--   sur n'importe quel écran). Deux coches bleues : tous l'ont LU (conversation
--   ouverte). Dans la bulle comme dans la liste des conversations.
--   - colonne conversation_membres.recu_le (défaut maintenant : l'existant passe
--     pour reçu) ;
--   - marquer_recu(conv) et marquer_recu_tout() : l'appli du destinataire les
--     appelle quand un message lui arrive en direct et quand elle s'ouvre ;
--   - marquer_lu() pose aussi recu_le (lire, c'est avoir reçu) ;
--   - mes_conversations() renvoie pour le dernier message : autres, recu_par, lu_par.
--   La conversation ouverte et la liste écoutent déjà conversation_membres en
--   direct. Rejouable. Se termine par ses GRANT.
-- ============================================================
alter table conversation_membres add column if not exists recu_le timestamptz not null default now();

create or replace function marquer_lu(p_conversation bigint) returns void
language sql security invoker set search_path = public as $$
  update conversation_membres set lu_le = now(), recu_le = now()
   where conversation_id = p_conversation and membre = auth.uid()
$$;
revoke all on function marquer_lu(bigint) from public, anon;
grant execute on function marquer_lu(bigint) to authenticated;

create or replace function marquer_recu(p_conversation bigint) returns void
language sql security invoker set search_path = public as $$
  update conversation_membres set recu_le = now()
   where conversation_id = p_conversation and membre = auth.uid() and recu_le < now() - interval '1 second'
$$;
revoke all on function marquer_recu(bigint) from public, anon;
grant execute on function marquer_recu(bigint) to authenticated;

-- l'appli s'ouvre : tout ce qui m'attendait est reçu (une seule requête)
create or replace function marquer_recu_tout() returns void
language sql security invoker set search_path = public as $$
  update conversation_membres m set recu_le = now()
   where m.membre = auth.uid()
     and exists (select 1 from conversations c where c.id = m.conversation_id and c.dernier_message_le > m.recu_le)
$$;
revoke all on function marquer_recu_tout() from public, anon;
grant execute on function marquer_recu_tout() to authenticated;

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
                                         'autres',  (select count(*) from conversation_membres m where m.conversation_id = c.id and m.membre <> x.auteur),
                                         'recu_par', (select count(*) from conversation_membres m where m.conversation_id = c.id and m.membre <> x.auteur and m.recu_le >= x.cree_le),
                                         'lu_par',  (select count(*) from conversation_membres m where m.conversation_id = c.id and m.membre <> x.auteur and m.lu_le >= x.cree_le))
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

-- la lecture directe de conversation_membres (conversation ouverte) voit la nouvelle colonne
grant select (recu_le) on conversation_membres to authenticated;

insert into sante_fonctions_ouvertes (nom, raison) values
  ('marquer_recu', 'messages : mon appli a reçu ce qui m''attendait dans cette conversation'),
  ('marquer_recu_tout', 'messages : mon appli s''ouvre, tout ce qui m''attendait est reçu')
on conflict (nom) do nothing;

-- Vérification :  select mes_conversations()->0->'dernier'->>'recu_par';   -- un nombre (ou null sans message)
