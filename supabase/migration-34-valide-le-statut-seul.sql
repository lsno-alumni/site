-- Migration 34 — « Ils viennent d'arriver » ne doit pas se remplir sur un
-- changement de RÔLE.
--
-- Le déclencheur protege_colonnes() horodatait valide_par / valide_le dès que
-- le statut OU le rôle changeait. Conséquence : promouvoir un membre délégué le
-- faisait passer pour un nouvel arrivant, et effaçait au passage la trace de
-- QUI l'avait réellement validé.
--
-- Ce que ça touchait :
--   • l'accueil membre, section « Ils viennent d'arriver » (validés < 30 jours) ;
--   • push_rappels_quotidiens (B10) : le rappel « profil incomplet » à 14 jours
--     était repoussé d'autant ;
--   • relance_annuelle : les validés de moins de 60 jours sont exclus, un
--     changement de rôle décalait donc leur rappel ;
--   • valide_par : l'auteur de la validation devenait l'auteur du changement de rôle.
--   • les notifications push, elles, n'étaient PAS touchées : elles se déclenchent
--     sur les transitions de statut_compte, pas sur valide_le.
--
-- Correctif : n'horodater QUE lorsque le compte devient réellement validé. Les
-- contrôles de permission sont inchangés.
--
-- Rejouable : remplace la fonction, le déclencheur existant continue de l'appeler.

create or replace function protege_colonnes() returns trigger
language plpgsql security definer as $$
begin
  if (new.statut_compte is distinct from old.statut_compte
      or new.role is distinct from old.role) then
    if mon_role() not in ('delegue', 'admin') then
      raise exception 'Seuls les délégués et administrateurs peuvent modifier statut ou rôle.';
    end if;
    -- un délégué ne promeut pas au-delà de membre<->valide ; seuls les admins gèrent les rôles
    if new.role is distinct from old.role and mon_role() <> 'admin' then
      raise exception 'Seuls les administrateurs peuvent modifier les rôles.';
    end if;
  end if;

  -- Horodatage de la validation : seulement au passage à « validé », jamais sur
  -- un changement de rôle (sinon un délégué promu réapparaît en nouvel arrivant).
  if new.statut_compte is distinct from old.statut_compte
     and new.statut_compte = 'valide' then
    new.valide_par := auth.uid();
    new.valide_le  := now();
  end if;

  new.maj_le := now();
  return new;
end $$;
