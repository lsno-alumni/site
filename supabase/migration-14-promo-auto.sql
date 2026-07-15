-- ============================================================
-- Migration 14 — cycle de vie automatique des promotions
--
-- Deux événements annuels :
--   - fin JUIN : la promo en terminale sort → purement de
--     l'affichage, géré côté app par calcul de date (donnees.js),
--     rien à faire en base ;
--   - début OCTOBRE : une nouvelle promo entre au lycée → il faut
--     une ligne dans la table promotions (l'inscription et les
--     stats s'appuient dessus). C'est ce que fait ce cron.
--
-- Chaque 1er octobre à 6h UTC, la base ajoute elle-même la
-- promotion suivante (numéro max + 1, entrée = année courante,
-- bac = entrée + 3). Idempotent : si la ligne existe déjà,
-- il ne se passe rien. Prérequis : pg_cron (déjà activé en 13).
-- ============================================================

create or replace function ouvrir_nouvelle_promotion()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_annee int := extract(year from current_date);
begin
  -- garde-fou : n'agit qu'en octobre, et une seule fois par année d'entrée
  if extract(month from current_date) <> 10 then return; end if;
  if exists (select 1 from promotions where annee_entree = v_annee and etablissement = 'LSNO') then
    return;
  end if;

  insert into promotions (numero, annee_entree, annee_bac)
  select max(numero) + 1, v_annee, v_annee + 3
  from promotions where etablissement = 'LSNO';

  raise notice 'Promotion % ouverte (entrée %, bac %)',
    (select max(numero) from promotions where etablissement = 'LSNO'), v_annee, v_annee + 3;
end $$;

select cron.schedule(
  'ouverture-promo-octobre',
  '0 6 1 10 *',
  $$select ouvrir_nouvelle_promotion()$$
);

-- Vérification (facultatif) : la table doit lister P1..P9 aujourd'hui,
-- et P10 apparaîtra seule le 1er octobre 2026.
--   select numero, annee_entree, annee_bac from promotions order by numero;
