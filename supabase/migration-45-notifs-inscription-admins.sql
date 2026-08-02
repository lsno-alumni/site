-- Migration 45 — séparer les NOTIFICATIONS d'inscription des EMAILS d'inscription.
--
-- Erreur de conception de la migration 31 : la notification push aux admins
-- lisait le réglage « emails_inscription_admins ». Couper les emails coupait
-- donc aussi les notifications — exactement l'inverse de l'intention. Les
-- notifications sont ce qui A PERMIS de couper les emails : elles ne coûtent
-- rien au quota Brevo, arrivent tout de suite, et se lisent d'un coup d'œil.
-- Les lier revenait à retirer d'une main ce qu'on donnait de l'autre.
--
-- Chaque canal a désormais son interrupteur :
--   emails_inscription_admins  → les EMAILS aux admins   (Validation → État du système)
--   push_inscription_admins    → les NOTIFICATIONS aux admins (Validation → Notifications)
--
-- Ce qui NE change pas :
--   • les délégués sont prévenus dans tous les cas, par email et par notification ;
--   • le filet de sécurité tient sur les deux canaux — une promotion SANS délégué
--     validé alerte toujours les admins, interrupteur coupé ou non, sinon ces
--     demandes dormiraient sans que personne ne le sache.
--
-- Rejouable.

-- Le nouveau réglage, actif par défaut = comportement d'aujourd'hui.
insert into reglages (cle, actif) values ('push_inscription_admins', true)
  on conflict (cle) do nothing;

-- La notification lit désormais SON réglage, plus celui des emails.
create or replace function push_nouvelle_demande() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  num_promo int;
  admins_ok boolean;
  a_delegue boolean;
  cibles uuid[];
begin
  select numero into num_promo from promotions where id = new.promotion_id;
  admins_ok := reglage_actif('push_inscription_admins');   -- ⚠ plus emails_inscription_admins
  select exists (select 1 from profiles where role = 'delegue'
                   and statut_compte = 'valide' and promotion_id = new.promotion_id)
    into a_delegue;

  select array_agg(id) into cibles from profiles
   where statut_compte = 'valide'
     and ((role = 'delegue' and promotion_id = new.promotion_id)
          or (role = 'admin' and (admins_ok or not a_delegue)));

  perform envoyer_push_liste(cibles, 'Nouvelle demande d''inscription',
    new.prenom || ' ' || new.nom || ' (promo ' || num_promo || ') attend ta validation.',
    '/admin', 'mes_demandes');
  return new;
end $$;

-- Vérification :
--   select cle, actif from reglages order by cle;   -- doit lister les DEUX
--   select prosrc like '%push_inscription_admins%' from pg_proc
--    where proname = 'push_nouvelle_demande';       -- doit valoir true
