-- ============================================================
-- Migration 24 — un lycéen s'inscrit avec la situation « élève »
--   (à exécuter APRÈS la migration 23, une fois « eleve » ajouté au type).
--   Le domaine « eleve » (posé par l'app) déclenche situation = 'eleve'.
--   Le reste — verrous d'édition, bascule en ancien à la rentrée — est
--   piloté par la DATE côté application (donnees.js), rien à stocker.
-- ============================================================

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_domaine text := coalesce(new.raw_user_meta_data->>'domaine', 'autre');
begin
  insert into public.profiles (id, prenom, nom, promotion_id, domaine, domaine_precision, situation, email_contact)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'prenom', 'Prénom'),
    coalesce(new.raw_user_meta_data->>'nom', ''),
    (select id from promotions
      where numero = coalesce((new.raw_user_meta_data->>'promotion')::int, 1)),
    v_domaine,
    nullif(left(coalesce(new.raw_user_meta_data->>'domaine_precision', ''), 40), ''),
    case when v_domaine = 'eleve' then 'eleve'::situation_t else 'etudiant'::situation_t end,
    new.email
  );
  return new;
end $$;
