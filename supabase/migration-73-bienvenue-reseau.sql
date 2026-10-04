-- ============================================================
-- Migration 73 — le message de bienvenue parle du réseau entier
--   L'email et la notification envoyés à la validation d'un compte disaient
--   « l'annuaire des anciens t'est ouvert » et menaient à l'annuaire. Depuis
--   le réseau social (migrations 52 → 72), c'est tout le réseau qui s'ouvre :
--   fil, messages, questions, moments, événements, groupes. Le message le dit
--   et mène à l'accueil connecté, où le tour des nouveautés prend le relais.
--   Réécrit notifie_validation() (email, migration 04) et push_statut_compte()
--   (notification, migration 32) à l'identique hors ces deux textes. Rejouable.
-- ============================================================

-- ---------- email de validation (migration 04) ----------
create or replace function notifie_validation() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if old.statut_compte = 'en_attente' and new.statut_compte = 'valide' then
    select email into v_email from auth.users where id = new.id;
    perform envoyer_email(
      v_email, new.prenom,
      'Ton compte est validé — bienvenue ! 🎉',
      gabarit_email(
        'Bienvenue parmi les tiens 🎓',
        'Un délégué de ta promotion vient de valider ton compte, ' || new.prenom ||
        '. Le réseau t''est ouvert : l''annuaire des anciens, le fil, les messages, '
        || 'les questions aux anciens, les moments, les événements et les groupes. '
        || 'À ta première ouverture, un petit tour te montre tout ça — et pense à compléter ton profil '
        || '(photo, parcours, conseil aux cadets) pour être facile à trouver.',
        'Entrer dans le réseau',
        'https://lsno-alumni.vercel.app/'));
  end if;
  return new;
end $$;

-- ---------- notification de validation (migration 32) ----------
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
      'Bienvenue parmi les tiens — le réseau t''est ouvert : annuaire, fil, messages, questions, moments, événements.',
      '/', 'mes_demandes');

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
      'Tu as de nouveau accès au réseau.', '/', 'mes_demandes');
  end if;
  -- (en_attente → suspendu = refus d'inscription : volontairement silencieux)
  return new;
end $$;

-- Vérification :
--   select prosrc like '%Entrer dans le réseau%' from pg_proc where proname = 'notifie_validation';   -- true
