-- ============================================================
-- Migration 05 — notification des changements de rôle délégué
--   membre  -> délégué : email « Tu es maintenant délégué·e »
--   délégué -> membre  : email sobre de fin de rôle
-- S'appuie sur envoyer_email() et gabarit_email() de la migration 04.
-- ============================================================

create or replace function notifie_changement_role() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  num_promo int;
begin
  if old.role is not distinct from new.role then
    return new;
  end if;
  select email into v_email from auth.users where id = new.id;
  select numero into num_promo from promotions where id = new.promotion_id;

  if old.role = 'membre' and new.role = 'delegue' then
    perform envoyer_email(
      v_email, new.prenom,
      'Tu es maintenant délégué·e de la promo ' || num_promo || ' 🤝',
      gabarit_email(
        'Nouvelle responsabilité 🎓',
        'Félicitations ' || new.prenom || ' — tu es désormais <b>délégué·e de la promotion '
        || num_promo || '</b>.<br/><br/>Ton rôle : valider (ou refuser) les demandes '
        || 'd''inscription des camarades de ta promo — tu recevras un email à chaque '
        || 'nouvelle demande, et tout se passe dans l''onglet Validation (environ 30 '
        || 'secondes par demande). C''est toi qui gardes la porte du réseau pour ta promo.',
        'Ouvrir l''onglet Validation',
        'https://lsno-alumni.vercel.app/admin'));

  elsif old.role = 'delegue' and new.role = 'membre' then
    perform envoyer_email(
      v_email, new.prenom,
      'Ton rôle de délégué·e a pris fin',
      gabarit_email(
        'Merci pour ton service 🙏',
        new.prenom || ', ton rôle de délégué·e de la promotion ' || num_promo ||
        ' a pris fin — merci d''avoir gardé la porte du réseau. Ton profil et ton '
        || 'accès de membre restent bien sûr inchangés.',
        'Retour à l''annuaire',
        'https://lsno-alumni.vercel.app/annuaire'));
  end if;
  return new;
end $$;

create trigger profiles_notifie_role
  after update on profiles
  for each row execute function notifie_changement_role();
