-- ============================================================
-- Migration 13 — rappel annuel de mise à jour du profil
--   Chaque année en SEPTEMBRE (la rentrée), tous les membres
--   validés reçoivent un email : « ton profil est-il à jour ? »
--
-- Fonctionnement :
--   - pg_cron lance envoyer_rappels_annuels() chaque jour de
--     septembre à 9h UTC.
--   - À chaque passage, la fonction envoie AU PLUS 200 emails aux
--     membres pas encore rappelés cette année (colonne
--     rappel_envoye_le), puis s'arrête d'elle-même quand tout le
--     monde a été servi. À 400+ membres, l'envoi s'étale donc sur
--     2-3 jours — le quota Brevo (300/j, partagé avec le reste)
--     n'est jamais menacé.
--   - Objet sobre, sans emoji : leçon délivrabilité Gmail.
--
-- ⚠ AVANT D'EXÉCUTER : activer l'extension pg_cron dans le
--   dashboard (Database -> Extensions -> chercher « pg_cron »
--   -> Enable). Puis exécuter ce fichier tel quel.
-- ============================================================

-- mémorise le dernier rappel envoyé à chaque membre
alter table profiles add column if not exists rappel_envoye_le date;

create or replace function envoyer_rappels_annuels()
returns void language plpgsql security definer set search_path = public as $$
declare
  v record;
  envoyes int := 0;
begin
  -- ne fait quelque chose qu'en septembre (garde-fou si le cron change)
  if extract(month from current_date) <> 9 then return; end if;

  for v in
    select u.email, p.prenom, p.id
    from profiles p
    join auth.users u on u.id = p.id
    where p.statut_compte = 'valide'
      -- jamais rappelé, ou pas encore cette année
      and (p.rappel_envoye_le is null
           or extract(year from p.rappel_envoye_le) < extract(year from current_date))
      -- pas les tout frais inscrits : validé depuis plus de 60 jours
      and (p.valide_le is null or p.valide_le < now() - interval '60 days')
    order by p.valide_le nulls first
    limit 200
  loop
    perform envoyer_email(
      v.email, v.prenom,
      'Ton profil LSNO Amicale est-il à jour ?',
      gabarit_email(
        'Petit rendez-vous de la rentrée',
        'Bonjour ' || v.prenom || ', une année est passée sur le réseau. '
        || 'Ton poste, ta ville, ton parcours ou ton conseil aux cadets ont '
        || 'peut-être changé — un profil à jour aide les autres à te trouver, '
        || 'et les cadets à s''orienter. Deux minutes suffisent.',
        'Vérifier mon profil',
        'https://lsno-alumni.vercel.app/mon-profil'));
    update profiles set rappel_envoye_le = current_date where id = v.id;
    envoyes := envoyes + 1;
  end loop;

  raise notice 'Rappels annuels envoyés : %', envoyes;
end $$;

-- chaque jour de septembre à 9h UTC (la fonction s'arrête seule
-- quand tout le monde a reçu son rappel de l'année)
select cron.schedule(
  'rappel-annuel-profils',
  '0 9 * 9 *',
  $$select envoyer_rappels_annuels()$$
);

-- ------------------------------------------------------------
-- Pour TESTER tout de suite sans attendre septembre (optionnel) :
--   1) commente temporairement le garde-fou « month <> 9 » ci-dessus
--      (ré-exécute le create or replace function), puis :
--   2) select envoyer_rappels_annuels();
--   3) remets le garde-fou. Pour re-tester sur ton compte :
--      update profiles set rappel_envoye_le = null where id = auth.uid();
-- ------------------------------------------------------------
