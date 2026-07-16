-- ============================================================
-- Migration 17 — retour pilote : préciser son domaine quand
-- « Autre » est choisi. La précision remplace le mot « Autre »
-- sur la fiche annuaire et le profil ; le FILTRE, lui, continue
-- de regrouper sous « Autre » (les familles restent stables).
-- ============================================================

alter table profiles
  add column if not exists domaine_precision text
    check (domaine_precision is null or char_length(domaine_precision) <= 40);

-- (liste fermée de colonnes depuis la migration 03 → grant explicite)
grant select (domaine_precision) on profiles to authenticated;

-- le profil créé à l'inscription récupère la précision des métadonnées
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, prenom, nom, promotion_id, domaine, domaine_precision, email_contact)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'prenom', 'Prénom'),
    coalesce(new.raw_user_meta_data->>'nom', ''),
    (select id from promotions
      where numero = coalesce((new.raw_user_meta_data->>'promotion')::int, 1)),
    coalesce(new.raw_user_meta_data->>'domaine', 'autre'),
    nullif(left(coalesce(new.raw_user_meta_data->>'domaine_precision', ''), 40), ''),
    new.email
  );
  return new;
end $$;
