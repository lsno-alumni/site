-- ============================================================
-- Migration 27 — RÉGLAGES + interrupteur des emails d'inscription aux ADMINS
--   Le jour d'un lancement de promo entière, les admins n'ont pas besoin de
--   recevoir un email par inscription (les délégués s'en chargent) : ça noie
--   la boîte ET brûle le quota Brevo (300/j partagés, l'email VITAL étant la
--   confirmation d'inscription).
--
--   Interrupteur réversible depuis Validation → État du système.
--   Les emails des DÉLÉGUÉS ne changent jamais.
--
--   Filet de sécurité : même désactivé, les admins sont prévenus pour les
--   promotions qui n'ont PAS ENCORE de délégué validé — sinon ces demandes
--   pourraient dormir sans que personne ne soit alerté.
-- ============================================================

create table if not exists reglages (
  cle     text primary key,
  actif   boolean not null default true,
  maj_le  timestamptz not null default now()
);

grant select, update on reglages to authenticated;
alter table reglages enable row level security;

-- lecture : membres validés (l'UI admin l'affiche ; aucune donnée sensible)
create policy reglages_lecture on reglages
  for select to authenticated
  using ((select statut_compte from profiles where id = auth.uid()) = 'valide');

-- modification : administrateurs seulement
create policy reglages_maj on reglages
  for update to authenticated
  using (est_admin());

-- réglage par défaut : les admins reçoivent les notifications (comportement actuel)
insert into reglages (cle, actif) values ('emails_inscription_admins', true)
  on conflict (cle) do nothing;

-- lecture pratique (défaut = true si la ligne manque)
create or replace function reglage_actif(p_cle text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select actif from reglages where cle = p_cle), true)
$$;

-- ---------- 1) trigger « nouvelle demande d'inscription » ----------
-- Remplace la version de la migration 04 : respecte l'interrupteur.
create or replace function notifie_nouvelle_demande() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v record;
  num_promo int;
  admins_ok boolean;
  promo_a_delegue boolean;
begin
  select numero into num_promo from promotions where id = new.promotion_id;
  admins_ok := reglage_actif('emails_inscription_admins');
  -- cette promotion a-t-elle déjà un délégué validé ?
  select exists (
    select 1 from profiles
    where role = 'delegue' and statut_compte = 'valide'
      and promotion_id = new.promotion_id
  ) into promo_a_delegue;

  for v in
    select u.email, p.prenom
    from profiles p
    join auth.users u on u.id = p.id
    where p.statut_compte = 'valide'
      and (
        -- le délégué de la promotion concernée : toujours prévenu
        (p.role = 'delegue' and p.promotion_id = new.promotion_id)
        -- les admins : si l'interrupteur est actif, OU si la promo n'a pas de délégué
        or (p.role = 'admin' and (admins_ok or not promo_a_delegue))
      )
  loop
    perform envoyer_email(
      v.email, v.prenom,
      'Nouvelle demande : ' || new.prenom || ' ' || new.nom || ' (Promo ' || num_promo || ')',
      gabarit_email(
        'Nouvelle demande d''inscription',
        '<b>' || new.prenom || ' ' || new.nom || '</b> se déclare de la promotion ' || num_promo ||
        ' et attend ta validation.',
        'Valider ou refuser',
        'https://lsno-alumni.vercel.app/admin'));
  end loop;
  return new;
end $$;

-- ---------- 2) relance hebdomadaire « inscriptions en attente » ----------
-- Remplace la version de la migration 15 : respecte l'interrupteur.
create or replace function relance_inscriptions() returns void
language plpgsql security definer set search_path = public as $$
declare
  v record;
  n int;
  admins_ok boolean;
begin
  admins_ok := reglage_actif('emails_inscription_admins');
  for v in
    select d.id, u.email, d.prenom, d.role, d.promotion_id
    from profiles d
    join auth.users u on u.id = d.id
    where d.statut_compte = 'valide' and d.role in ('delegue', 'admin')
  loop
    select count(*) into n
    from profiles p
    join auth.users pu on pu.id = p.id
    where p.statut_compte = 'en_attente'
      and pu.email_confirmed_at is not null
      and p.cree_le < now() - interval '3 days'
      and (
        case
          when v.role = 'delegue' then p.promotion_id = v.promotion_id
          -- admin : tout si l'interrupteur est actif ; sinon uniquement les
          -- promotions sans délégué validé (filet de sécurité)
          when admins_ok then true
          else not exists (
            select 1 from profiles dg
            where dg.role = 'delegue' and dg.statut_compte = 'valide'
              and dg.promotion_id = p.promotion_id
          )
        end
      );

    if n > 0 then
      perform envoyer_email(
        v.email, v.prenom,
        n || ' inscription' || case when n > 1 then 's' else '' end || ' en attente de validation',
        gabarit_email(
          'Des camarades attendent',
          'Bonjour ' || v.prenom || ', ' || n || ' demande' || case when n > 1 then 's' else '' end
          || ' d''inscription attend' || case when n > 1 then 'ent' else '' end
          || ' depuis plus de 3 jours. Un coup d''œil suffit pour valider ou refuser.',
          'Ouvrir la validation',
          'https://lsno-alumni.vercel.app/admin'));
    end if;
  end loop;
end $$;
