-- ============================================================
-- Migration 74 — des notifications qui disent vrai (retours du 01/10)
--   1) Clôture des offres expirées : la tâche tournait le 1er du mois, donc un
--      posteur apprenait « ton offre est arrivée à échéance — republie-la »
--      jusqu'à trois semaines après la date limite, alors que l'offre était
--      déjà cachée depuis le lendemain. Elle tourne désormais CHAQUE JOUR, et ne
--      prévient (email + notification) que si l'échéance date de moins de
--      3 jours ; au-delà, clôture silencieuse.
--   2) Annonce de rentrée (1er octobre) : « La promotion N est ouverte » part
--      dans la famille « réseau » et se faisait avaler, sur le téléphone, par le
--      résumé « 4 nouveaux membres ». Elle est marquée « seule » : jamais
--      regroupée (public/sw.js lit ce drapeau).
--   Rejouable. Le contrôle de santé ne vérifie que le NOM de la tâche.
-- ============================================================

-- ---------- 1) clôture quotidienne, notification seulement si récente ----------
create or replace function cloture_offres_expirees() returns void
language plpgsql security definer set search_path = public as $$
declare v record;
begin
  for v in
    select o.id, o.titre, o.posteur, u.email, p.prenom,
           -- échéance récente = date limite passée depuis moins de 3 jours, ou
           -- 60 jours de publication tout juste atteints (sans date limite)
           (o.date_limite is not null and o.date_limite >= current_date - 3)
           or (o.date_limite is null and o.cree_le >= now() - interval '63 days') as recente
    from offres o
    join profiles p on p.id = o.posteur
    join auth.users u on u.id = o.posteur
    where o.statut = 'active'
      and (o.date_limite < current_date
           or (o.date_limite is null and o.cree_le < now() - interval '60 days'))
  loop
    update offres set statut = 'cloturee' where id = v.id;
    if v.recente then
      perform envoyer_email(
        v.email, v.prenom,
        'Ton offre « ' || left(v.titre, 40) || ' » est arrivée à échéance',
        gabarit_email(
          'Offre arrivée à échéance',
          'Bonjour ' || v.prenom || ', ton offre <b>' || v.titre || '</b> a été retirée '
          || 'automatiquement (date limite passée ou 60 jours de publication). '
          || 'Si l''opportunité est toujours ouverte, republie-la en un instant.',
          'Voir les offres',
          'https://lsno-alumni.vercel.app/offres'));
      perform envoyer_push(v.posteur, 'Ton offre est arrivée à échéance',
        left(v.titre, 80) || ' — republie-la si elle est toujours ouverte.',
        '/offres', 'mes_demandes');
    end if;
  end loop;
end $$;

-- la tâche passe de mensuelle (1er du mois, 5h30) à quotidienne (5h30)
do $$ begin
  if exists (select 1 from cron.job where jobname = 'cloture-offres') then
    perform cron.unschedule('cloture-offres');
  end if;
end $$;
select cron.schedule('cloture-offres', '30 5 * * *', $$select cloture_offres_expirees()$$);

-- ---------- 2) l'annonce de rentrée n'est jamais regroupée ----------
create or replace function push_rentree_octobre() returns void
language plpgsql security definer set search_path = public as $$
declare
  sortants uuid[];
  nouvelle int;
begin
  -- B13 : ceux dont le bac est l'année en cours passent « anciens » ce mois-ci
  select array_agg(p.id) into sortants
    from profiles p join promotions pr on pr.id = p.promotion_id
   where p.statut_compte = 'valide'
     and pr.annee_bac = extract(year from now())::int;
  perform envoyer_push_liste(sortants, 'Te voilà parmi les anciens 🎓',
    'Choisis ton domaine et ta situation pour être trouvable par les cadets.',
    '/mon-profil', 'mes_demandes');

  -- B14 : la promotion qui vient d'ouvrir — à tout le réseau, affichée telle quelle
  select max(numero) into nouvelle from promotions;
  perform envoyer_push_liste(membres_valides(), 'La promotion ' || nouvelle || ' est ouverte',
    'Une nouvelle génération entre au LSNO — le réseau s''agrandit.',
    '/annuaire', 'reseau', null::text, '{"seul": true}'::jsonb);
end $$;

-- Vérification :
--   select schedule from cron.job where jobname = 'cloture-offres';   -- 30 5 * * *
