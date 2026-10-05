-- Migration 86 (05/10/2026) : la purge quotidienne des pièces jointes échouait depuis le 04/10.
-- Cause (journal de cron.job_run_details) : « new row for relation "messages" violates check
-- constraint "messages_texte_check" ». Un vocal (ou une photo envoyée sans texte) a un texte vide ;
-- quand sa pièce expire, purge_pieces() met fichier_chemin à null, et la règle « un message a un
-- texte OU une pièce OU un sondage » refuse la ligne. La boucle s'arrêtait au premier vocal expiré
-- et plus rien n'était purgé.
-- Correctif : la règle admet aussi une pièce EXPIRÉE (le message reste, l'écran affiche
-- « pièce jointe expirée »). Rien d'autre ne change ; la prochaine purge à 4 h 50 rattrape tout.

alter table messages drop constraint if exists messages_texte_check;
alter table messages add constraint messages_texte_check
  check (char_length(btrim(texte)) <= 2000
         and (char_length(btrim(texte)) >= 1 or fichier_chemin is not null or fichier_expiree or sondage_id is not null));

-- ---------- même ton pour les relances (texte retenu le 05/10) ----------
create or replace function relancer_profils_incomplets() returns int
language plpgsql security definer set search_path = public as $$
declare
  v record; n int := 0; manque text; seuils int[] := array[3, 14, 45];
begin
  for v in
    select p.id, p.prenom, u.email, p.relances_profil, p.situation, p.photo_url, p.statut_titre, p.ville, p.pays
      from profiles p join auth.users u on u.id = p.id
     where p.statut_compte = 'valide'
       and p.relances_profil < 3
       and not profil_complet(p.id)
       and coalesce(p.valide_le, p.cree_le) < now() - make_interval(days => seuils[p.relances_profil + 1])
       and (p.relance_profil_le is null or p.relance_profil_le < now() - interval '10 days')
     order by p.relance_profil_le nulls first, coalesce(p.valide_le, p.cree_le)
     limit 60
  loop
    manque := array_to_string(array_remove(array[
      case when nullif(btrim(coalesce(v.photo_url, '')), '') is null then 'une photo' end,
      case when coalesce(v.situation <> 'eleve', true) and nullif(btrim(coalesce(v.statut_titre, '')), '') is null then 'une ligne sur toi' end,
      case when nullif(btrim(coalesce(v.ville, '')), '') is null then 'ta ville' end,
      case when nullif(btrim(coalesce(v.pays, '')), '') is null then 'ton pays' end
    ], null), ', ');
    begin
      if exists (select 1 from push_abonnements a where a.profil = v.id) then
        perform envoyer_push_liste(array[v.id], 'Dis-leur qui tu es',
          'Pour que les autres membres te reconnaissent, ajoute ' || manque || '. C''est tout ce qu''il manque pour écrire, demander un contact et voir leurs coordonnées.',
          '/mon-profil', 'reseau', null, null);
      else
        perform envoyer_email(v.email, v.prenom, 'Il manque ' || manque || ' sur ton profil LSNO Amicale',
          gabarit_email('Dis-leur qui tu es',
            'Bonjour ' || coalesce(v.prenom, '') || ', pour que les autres membres du réseau te reconnaissent, ajoute ' || manque || '. '
            || 'C''est tout ce qu''il manque pour écrire aux anciens, demander un contact et voir leurs coordonnées. Une minute suffit.',
            'Compléter mon profil', 'https://lsno-alumni.vercel.app/mon-profil'));
      end if;
    exception when others then null;
    end;
    update profiles set relances_profil = relances_profil + 1, relance_profil_le = now() where id = v.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function relancer_profils_incomplets() from public, anon, authenticated;

-- Vérification :
--   select purge_pieces();   -- doit renvoyer le nombre de pièces traitées, sans erreur
--   select count(*) from messages where fichier_expire_le < now() and not fichier_expiree and fichier_chemin is not null;   -- 0 après le passage
