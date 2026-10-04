-- ============================================================
-- Migration 70 — comptes de test des notifications gérés depuis l'interface
--   La table push_essai_comptes (migration 63) n'est lue que par les fonctions.
--   Trois fonctions réservées aux administrateurs : lister, ajouter, retirer
--   (journalisées). Rejouable.
-- ============================================================
create or replace function admin_essai_comptes() returns json
language sql stable security definer set search_path = public as $$
  select case when est_admin() then coalesce(json_agg(json_build_object(
    'id', p.id, 'prenom', p.prenom, 'nom', p.nom, 'photo_url', p.photo_url,
    'promo', (select numero from promotions where id = p.promotion_id), 'ajoute_le', c.ajoute_le) order by c.ajoute_le), '[]'::json)
    else '[]'::json end
  from push_essai_comptes c join profiles p on p.id = c.profil
$$;
revoke all on function admin_essai_comptes() from public, anon;
grant execute on function admin_essai_comptes() to authenticated;

create or replace function admin_essai_ajouter(p_profil uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not est_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  if not exists (select 1 from profiles where id = p_profil and statut_compte = 'valide') then raise exception 'Membre introuvable ou non validé.'; end if;
  insert into push_essai_comptes (profil) values (p_profil) on conflict (profil) do nothing;
  perform journaliser('compte_essai_ajoute', p_profil, '{}'::jsonb);
end $$;
revoke all on function admin_essai_ajouter(uuid) from public, anon;
grant execute on function admin_essai_ajouter(uuid) to authenticated;

create or replace function admin_essai_retirer(p_profil uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not est_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  delete from push_essai_comptes where profil = p_profil;
  perform journaliser('compte_essai_retire', p_profil, '{}'::jsonb);
end $$;
revoke all on function admin_essai_retirer(uuid) from public, anon;
grant execute on function admin_essai_retirer(uuid) to authenticated;

insert into sante_fonctions_ouvertes (nom, raison) values
  ('admin_essai_comptes',  'admin : les comptes de test des notifications'),
  ('admin_essai_ajouter',  'admin : ajouter un compte de test (journalisé)'),
  ('admin_essai_retirer',  'admin : retirer un compte de test (journalisé)')
on conflict (nom) do nothing;

-- Vérification :
--   select admin_essai_comptes();   -- la liste (compte Test Tester au moins)
