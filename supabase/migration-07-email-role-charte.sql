-- ============================================================
-- Migration 07 — emails de rôle : retour à la charte (bouton doré,
-- fond bleu nuit) MAIS en conservant les objets/ton sobres de la
-- migration 06 (ce sont eux, pas le style, qui évitaient l'onglet
-- « Promotions » de Gmail). Réutilise gabarit_email() (migration 04).
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
      'Ton nouveau rôle sur LSNO Amicale',   -- objet sobre (pas d'emoji ni « promotion »)
      gabarit_email(
        'Ton nouveau rôle',
        'Bonjour ' || new.prenom || ', tu es désormais délégué·e de ta promotion (promo '
        || num_promo || '). Ton rôle : valider les demandes d''inscription de tes camarades de '
        || 'promo — tu reçois un message à chaque nouvelle demande, et tu valides ou refuses en '
        || 'un geste depuis l''onglet Validation. C''est toi qui gardes la porte du réseau pour ta promo.',
        'Ouvrir l''onglet Validation',
        'https://lsno-alumni.vercel.app/admin'));

  elsif old.role = 'delegue' and new.role = 'membre' then
    perform envoyer_email(
      v_email, new.prenom,
      'Fin de ton rôle de délégué sur LSNO Amicale',
      gabarit_email(
        'Fin de ton rôle de délégué',
        'Bonjour ' || new.prenom || ', ton rôle de délégué·e de la promo ' || num_promo ||
        ' a pris fin — merci d''avoir gardé la porte du réseau. Ton profil et ton accès de '
        || 'membre restent inchangés.',
        'Retour à l''annuaire',
        'https://lsno-alumni.vercel.app/annuaire'));
  end if;
  return new;
end $$;
