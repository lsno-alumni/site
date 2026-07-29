-- ============================================================
-- Migration 32 — PORTÉE des notifications « Le réseau »
--   Retour de membres : pouvoir être prévenu des arrivées de TOUT le réseau,
--   ou seulement de son domaine, etc. Plutôt que deux interrupteurs qui se
--   chevauchent, on modélise un CHOIX DE PORTÉE (une seule valeur) :
--     tout | promo_domaine (défaut, comportement actuel) | promo | domaine
--   L'interrupteur push_reseau reste le Oui/Non maître.
--
--   Ajoute aussi le DOMAINE dans le texte de la notification d'arrivée.
-- ============================================================

alter table profiles
  add column if not exists push_reseau_portee text not null default 'promo_domaine';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_push_reseau_portee_ok') then
    alter table profiles add constraint profiles_push_reseau_portee_ok
      check (push_reseau_portee in ('tout', 'promo_domaine', 'promo', 'domaine'));
  end if;
end $$;

-- rappel du piège maison : le SELECT sur profiles est une LISTE FERMÉE
grant select (push_reseau_portee) on profiles to authenticated;
grant update (push_reseau_portee) on profiles to authenticated;

-- ------------------------------------------------------------
-- Nom lisible d'un domaine, côté base (pour le texte des notifications).
-- ⚠ MIROIR de DOMAINES / nomDomaine() dans src/lib/donnees.js :
--   si tu ajoutes un domaine côté JS, ajoute-le ICI aussi.
-- ------------------------------------------------------------
create or replace function nom_domaine(p_cle text, p_precision text default null)
returns text language sql immutable as $$
  select case
    when p_cle = 'eleve' then 'Élève'
    when p_cle = 'autre' then coalesce(nullif(trim(coalesce(p_precision, '')), ''), 'Autre')
    when p_cle = 'aero' then 'Aéronautique'
    when p_cle = 'agro' then 'Agronomie'
    when p_cle = 'archi' then 'Architecture'
    when p_cle = 'arts' then 'Arts et médias'
    when p_cle = 'commerce' then 'Commerce et management'
    when p_cle = 'defense' then 'Défense et sécurité'
    when p_cle = 'droit' then 'Droit'
    when p_cle = 'eco' then 'Économie et finance'
    when p_cle = 'enseignement' then 'Enseignement'
    when p_cle = 'info' then 'Informatique'
    when p_cle = 'inge' then 'Ingénierie'
    when p_cle = 'maths' then 'Maths et recherche'
    when p_cle = 'sante' then 'Santé et médecine'
    when p_cle = 'stats' then 'Statistiques et data'
    else null
  end
$$;

-- ------------------------------------------------------------
-- A2 (bienvenue) + B5/B6 (arrivée annoncée selon la PORTÉE de chacun)
-- + B8 (suspension / réactivation) — remplace la version de la migration 31
-- ------------------------------------------------------------
create or replace function push_statut_compte() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  num_promo int;
  dom text;
  cibles uuid[];
begin
  if old.statut_compte = new.statut_compte then return new; end if;

  -- A2 : bienvenue
  if old.statut_compte = 'en_attente' and new.statut_compte = 'valide' then
    perform envoyer_push(new.id, 'Ton compte est validé 🎓',
      'Bienvenue parmi les tiens — l''annuaire des anciens t''est ouvert.',
      '/annuaire', 'mes_demandes');

    -- B5 + B6 : chaque membre est prévenu selon SA portée (sans doublon)
    select numero into num_promo from promotions where id = new.promotion_id;
    dom := nom_domaine(new.domaine, new.domaine_precision);

    select array_agg(distinct p.id) into cibles
      from profiles p
     where p.statut_compte = 'valide'
       and p.id <> new.id
       and case coalesce(p.push_reseau_portee, 'promo_domaine')
             when 'tout'    then true
             when 'promo'   then p.promotion_id = new.promotion_id
             when 'domaine' then new.domaine is not null and p.domaine = new.domaine
             else p.promotion_id = new.promotion_id
                  or (new.domaine is not null and p.domaine = new.domaine)
           end;

    perform envoyer_push_liste(cibles, 'Un nouveau membre a rejoint le réseau',
      new.prenom || ' ' || new.nom || ' — promo ' || num_promo
        || coalesce(' · ' || dom, ''),
      '/profil/' || new.id, 'reseau');

  -- B8 : suspension d'un compte actif
  elsif old.statut_compte = 'valide' and new.statut_compte = 'suspendu' then
    perform envoyer_push(new.id, 'Ton compte a été suspendu',
      'Contacte les administrateurs du réseau pour en savoir plus.',
      '/a-propos', 'mes_demandes');

  -- B8 : réactivation
  elsif old.statut_compte = 'suspendu' and new.statut_compte = 'valide' then
    perform envoyer_push(new.id, 'Ton compte est réactivé',
      'Tu as de nouveau accès au réseau.', '/annuaire', 'mes_demandes');
  end if;
  -- (en_attente → suspendu = refus d'inscription : volontairement silencieux)
  return new;
end $$;
