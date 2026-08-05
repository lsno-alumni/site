-- Migration 48 — le mail du contrôle de santé donnait toujours le MÊME conseil.
--
-- Constaté le 03/08 : le contrôle a signalé « 6. fonctions verrouillées » (une
-- fonction de déclencheur restée exécutable par les membres, oubli de la
-- migration 46). Le mail a répondu par son unique texte de dépannage figé :
-- « une migration contenant du DDL a retiré des privilèges — rétablir avec
-- migration-38 et migration-39 ». C'était la bonne piste pour l'incident du
-- 01/08 (celui qui a fait écrire ce texte) — mais elle n'a AUCUN rapport avec
-- une fonction qui n'a jamais eu ses droits retirés parce qu'elle ne les a
-- jamais reçus au départ. Un admin qui suivrait ce conseil à la lettre
-- tournerait en rond : migration-38/39 ne change rien à une fonction oubliée.
--
-- Le conseil dépend maintenant des catégories RÉELLEMENT en cause ce mois-ci,
-- pas d'un seul cas mémorisé une fois pour toutes.
--
-- Rejouable.

create or replace function controle_sante() returns text
language plpgsql security definer set search_path = public as $$
declare
  soucis text[] := '{}';
  conseils text[] := '{}';
  domaines text[];
  v record;
  n int;
  corps text;
begin
  for v in select domaine, controle, attendu, constate, verdict
             from sante_systeme where verdict like 'PROBL%'
            order by domaine, controle
  loop
    soucis := soucis || (v.domaine || ' · ' || v.controle || ' : ' || v.verdict
                         || ' (attendu ' || v.attendu || ', constaté ' || v.constate || ')');
  end loop;

  n := coalesce(array_length(soucis, 1), 0);

  perform journaliser('controle_sante', null, jsonb_build_object('soucis', n));

  if n = 0 then
    return 'ok — aucun problème';
  end if;

  select array_agg(distinct domaine) into domaines
    from sante_systeme where verdict like 'PROBL%';

  if '1. droits de table' = any(domaines) then
    conseils := conseils || ('« droits de table » : un GRANT manque pour un rôle sur une table — '
      || 'cas typique après une migration contenant du DDL, qui retire parfois des privilèges sans '
      || 's''en rendre compte. Modèle : migration-38 et migration-39.');
  end if;
  if '2. rôle anonyme' = any(domaines) then
    conseils := conseils || ('« rôle anonyme » : le rôle anon a reçu un droit qu''il ne devrait '
      || 'jamais avoir (il ne doit rien pouvoir lire ni écrire) — le retirer par un REVOKE explicite.');
  end if;
  if '3. pouvoirs dangereux' = any(domaines) then
    conseils := conseils || ('« pouvoirs dangereux » : un rôle a TRUNCATE, TRIGGER ou REFERENCES '
      || 'sur une table où il ne devrait avoir que SELECT/INSERT/UPDATE/DELETE — REVOKE ce pouvoir '
      || '(modèle : migration-39).');
  end if;
  if '4. RLS' = any(domaines) then
    conseils := conseils || ('« RLS » : Row Level Security n''est plus activée sur une table, ou '
      || 'une politique attendue a disparu — vérifier ALTER TABLE … ENABLE ROW LEVEL SECURITY et '
      || 'les CREATE POLICY de la migration qui a créé cette table.');
  end if;
  if '5. séquences' = any(domaines) then
    conseils := conseils || ('« séquences » : un rôle a perdu USAGE/SELECT sur la séquence d''une '
      || 'table qu''il peut par ailleurs modifier — GRANT USAGE, SELECT ON SEQUENCE … TO ce rôle.');
  end if;
  if '6. fonctions verrouillées' = any(domaines) then
    conseils := conseils || ('« fonctions verrouillées » : une fonction à privilèges (security '
      || 'definer) reste exécutable par un membre. Deux cas : ① c''est une fonction INTERNE '
      || '(déclencheur, fonction d''aide jamais appelée depuis le navigateur) — lui ajouter '
      || '« revoke all on function nom() from public, anon, authenticated » (modèle : migration-36, '
      || 'journal_profil()) ; ② c''est une vraie RPC du site, appelée depuis un écran — la déclarer '
      || 'dans la table sante_fonctions_ouvertes avec sa raison.');
  end if;
  if '7. fonctions ouvertes' = any(domaines) then
    conseils := conseils || ('« fonctions ouvertes » : la table sante_fonctions_ouvertes contient '
      || 'une entrée qui ne correspond plus à la réalité — une fonction déclarée là a été '
      || 'supprimée, ou n''est en fait plus exécutable comme prévu. Comparer son contenu '
      || '(select * from sante_fonctions_ouvertes) aux fonctions security definer existantes.');
  end if;
  if '8. tâches planifiées' = any(domaines) then
    conseils := conseils || ('« tâches planifiées » : un cron attendu est absent ou désactivé — '
      || 'select cron.schedule(''nom'', ''horaire'', ''requête'') pour le recréer (voir la migration '
      || 'qui l''a introduit pour la formule exacte).');
  end if;
  if '9. déclencheurs' = any(domaines) then
    conseils := conseils || ('« déclencheurs » : un trigger attendu est absent — retrouver son '
      || 'CREATE TRIGGER dans la migration qui l''a créé et le rejouer (les migrations sont conçues '
      || 'pour être rejouées sans risque).');
  end if;
  if '10. secrets' = any(domaines) then
    conseils := conseils || ('« secrets » : un secret attendu manque dans le Vault — '
      || 'select vault.create_secret(''la valeur'', ''le nom attendu'');');
  end if;
  if '11. schéma' = any(domaines) then
    conseils := conseils || ('« schéma » : une colonne ou une table attendue manque — une migration '
      || 'n''a probablement pas été exécutée. Vérifier avec supabase/verif-migrations.sql, qui dit '
      || 'PRÉCISÉMENT laquelle.');
  end if;

  corps := 'Le contrôle automatique de la base a relevé <b>' || n
        || ' problème(s)</b> :<br><br>• ' || array_to_string(soucis, '<br>• ')
        || '<br><br><b>Piste' || (case when array_length(conseils, 1) > 1 then 's' else '' end)
        || ' :</b><br>• ' || array_to_string(conseils, '<br>• ')
        || '<br><br>Le détail complet est dans <i>supabase/verif-sante.sql</i> '
        || '(à coller dans l''éditeur SQL), et la démarche générale dans CONTRIBUTING (§ Pièges connus).';

  for v in
    select u.email, p.prenom
      from profiles p join auth.users u on u.id = p.id
     where p.role = 'admin' and p.statut_compte = 'valide'
  loop
    perform envoyer_email(
      v.email, v.prenom,
      'LSNO Amicale — le contrôle de la base a relevé ' || n || ' problème(s)',
      gabarit_email('Contrôle de la base : ' || n || ' problème(s)', corps,
                    'Ouvrir le site', 'https://lsno-alumni.vercel.app/admin'));
  end loop;

  perform envoyer_push_liste(
    (select array_agg(id) from profiles where role = 'admin' and statut_compte = 'valide'),
    'Contrôle de la base : ' || n || ' problème(s)',
    'Des droits ou des tâches ne sont plus conformes — regarde tes emails.',
    '/admin', 'annonces');

  return array_to_string(soucis, chr(10));
end $$;

revoke all on function controle_sante() from public, anon, authenticated;

-- Vérification :
--   select controle_sante();
--   -- si tout va bien : « ok — aucun problème »
--   -- pour voir un mail de test avec un vrai conseil ciblé, retirer
--   -- temporairement un droit connu puis relancer, ex. :
--   --   revoke select on promotions from authenticated;
--   --   select controle_sante();          -- le conseil doit citer « droits de table »
--   --   grant select on promotions to authenticated;   -- remettre en ordre !
