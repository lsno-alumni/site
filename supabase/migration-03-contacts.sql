-- ============================================================
-- Migration 03 — contacts réels + confidentialité au niveau base
-- Les valeurs de contact (whatsapp, email, linkedin) ne sont plus
-- lisibles directement : elles ne sortent que via deux fonctions
-- qui respectent la visibilité choisie par chaque membre.
-- ============================================================

-- 1) Lecture directe : toutes les colonnes SAUF les valeurs de contact
revoke select on profiles from authenticated;
grant select (id, prenom, nom, photo_url, promotion_id, domaine, situation,
              statut_titre, bio, conseil, repond_cadets, ville, pays,
              whatsapp_visi, email_visi, linkedin_visi,
              statut_compte, role, valide_par, valide_le, cree_le, maj_le)
  on profiles to authenticated;

-- 2) Mes propres contacts (pour l'écran d'édition)
create or replace function mes_contacts()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'whatsapp', whatsapp, 'email', email_contact, 'linkedin', linkedin)
  from profiles where id = auth.uid();
$$;

-- 3) Les contacts d'un membre, filtrés par SA visibilité.
--    Réservé aux comptes validés ; une valeur « demande » ou « masqué »
--    ne quitte JAMAIS la base.
create or replace function contacts_de(cible uuid)
returns json language sql stable security definer set search_path = public as $$
  select case
    when (select statut_compte from profiles where id = auth.uid()) <> 'valide' then null
    else (
      select json_build_object(
        'whatsapp', case when p.whatsapp_visi = 'membres' then p.whatsapp end,
        'email',    case when p.email_visi    = 'membres' then p.email_contact end,
        'linkedin', case when p.linkedin_visi = 'membres' then p.linkedin end,
        'visi', json_build_object(
          'whatsapp', p.whatsapp_visi, 'email', p.email_visi, 'linkedin', p.linkedin_visi)
      ) from profiles p where p.id = cible and p.statut_compte = 'valide'
    )
  end;
$$;

grant execute on function mes_contacts() to authenticated;
grant execute on function contacts_de(uuid) to authenticated;
