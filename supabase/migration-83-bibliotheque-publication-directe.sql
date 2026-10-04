-- Migration 83 (04/10/2026) : bibliothèque — un délégué ou un administrateur qui propose un
-- document le publie directement, sans passer par la relecture. La fiche est marquée comme
-- modérée par lui-même, la décision va au journal (comme une publication ordinaire), et les
-- autres modérateurs ne sont pas dérangés par une notification « à relire ».
-- Les membres ordinaires : inchangé (en attente, modérateurs prévenus).

create or replace function bibliotheque_proposer(
  p_titre text, p_type text, p_matiere text, p_classe text, p_annee int, p_serie text,
  p_description text, p_lien text, p_drive_id text default null, p_taille int default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_moi uuid := auth.uid(); v_nom text; cibles uuid[]; v_direct boolean := est_moderateur();
begin
  if mon_statut() is distinct from 'valide' then raise exception 'Réservé aux membres validés.'; end if;
  insert into bibliotheque (titre, type, matiere, classe, annee, serie, description, lien, drive_id, taille, propose_par,
                            statut, modere_par, modere_le)
  values (btrim(p_titre), p_type, btrim(p_matiere), p_classe, p_annee, nullif(btrim(coalesce(p_serie, '')), ''),
          nullif(btrim(coalesce(p_description, '')), ''), btrim(p_lien), p_drive_id, p_taille, v_moi,
          case when v_direct then 'publie' else 'en_attente' end,
          case when v_direct then v_moi end,
          case when v_direct then now() end)
  returning id into v_id;
  if v_direct then
    -- publication directe : tracée au journal, personne à prévenir
    perform journaliser('bibliotheque', v_moi,
      jsonb_build_object('titre', btrim(p_titre), 'decision', 'publie', 'direct', true, 'matiere', btrim(p_matiere), 'annee', p_annee));
    return v_id;
  end if;
  -- membre ordinaire : les modérateurs sont prévenus
  select prenom into v_nom from profiles where id = v_moi;
  select array_agg(id) into cibles from profiles
   where statut_compte = 'valide' and role in ('delegue', 'admin') and id <> v_moi;
  if cibles is not null then
    perform envoyer_push_liste(cibles, 'Document proposé à la bibliothèque',
      coalesce(v_nom, 'Un membre') || ' propose « ' || left(btrim(p_titre), 80) || ' » (' || btrim(p_matiere) || ', ' || p_annee || ') — à relire.',
      '/admin#sec-bibliotheque', null);
  end if;
  return v_id;
end $$;
revoke all on function bibliotheque_proposer(text, text, text, text, int, text, text, text, text, int) from public, anon;
grant execute on function bibliotheque_proposer(text, text, text, text, int, text, text, text, text, int) to authenticated;

update sante_fonctions_ouvertes set raison = 'bibliothèque : un membre validé propose un document (publié d''emblée si délégué/admin)'
 where nom = 'bibliotheque_proposer';

-- Vérification :  select statut from bibliotheque order by cree_le desc limit 1;   -- 'publie' juste après une proposition faite par un délégué
