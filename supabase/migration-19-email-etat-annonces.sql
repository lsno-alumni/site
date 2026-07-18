-- ============================================================
-- Migration 19 — le back-office se termine dans le site :
--   ① changer l'email de connexion d'un membre (admin)
--   ② état du système : crons, fantômes, offres qui expirent
--   ③ annonce à tous les membres, étalée automatiquement
--      (150 emails/jour max — la moitié du quota Brevo partagé)
-- Prérequis : migrations 04 (emails), 13 (pg_cron), 18 (est_admin).
-- ============================================================

-- ---------- ① changement d'email de connexion ----------
-- Pour le membre qui a perdu l'accès à sa boîte email. L'admin vérifie
-- l'identité (WhatsApp) puis change l'email ; il est marqué confirmé.
create or replace function admin_change_email(cible uuid, nouvel_email text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not est_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  nouvel_email := lower(trim(nouvel_email));
  if nouvel_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Adresse email invalide.';
  end if;
  if exists (select 1 from auth.users where lower(email) = nouvel_email and id <> cible) then
    raise exception 'Cette adresse est déjà utilisée par un autre compte.';
  end if;
  update auth.users
     set email = nouvel_email, email_confirmed_at = coalesce(email_confirmed_at, now())
   where id = cible;
  -- l'identité « email » garde une copie de l'adresse : la synchroniser
  update auth.identities
     set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(nouvel_email))
   where user_id = cible and provider = 'email';
end $$;

-- ---------- ② état du système ----------
create or replace function admin_etat_systeme() returns json
language plpgsql security definer set search_path = public as $$
begin
  if not est_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  return json_build_object(
    'jobs', (
      select coalesce(json_agg(json_build_object(
        'nom', j.jobname,
        'planification', j.schedule,
        'derniere', (
          select json_build_object('quand', r.start_time, 'statut', r.status)
          from cron.job_run_details r
          where r.jobid = j.jobid
          order by r.start_time desc limit 1
        )
      ) order by j.jobname), '[]'::json)
      from cron.job j
    ),
    'fantomes', (
      select count(*) from auth.users
      where email_confirmed_at is null and created_at < now() - interval '30 days'
    ),
    'offres_expirent_14j', (
      select count(*) from offres
      where statut = 'active'
        and date_limite between current_date and current_date + 14
    )
  );
end $$;

-- ---------- ③ annonces aux membres, étalées ----------
create table if not exists annonces (
  id        bigserial primary key,
  sujet     text not null check (char_length(sujet) <= 120),
  corps     text not null check (char_length(corps) <= 2000),
  cree_par  uuid references profiles(id) on delete set null,
  cree_le   timestamptz not null default now(),
  terminee  boolean not null default false
);
create table if not exists annonce_envois (
  annonce_id bigint not null references annonces(id) on delete cascade,
  profile_id uuid   not null references profiles(id) on delete cascade,
  envoye_le  timestamptz not null default now(),
  primary key (annonce_id, profile_id)
);

-- lecture par les admins (suivi de progression dans l'UI)
grant select on annonces, annonce_envois to authenticated;
alter table annonces enable row level security;
alter table annonce_envois enable row level security;
create policy annonces_admin on annonces for select to authenticated using (est_admin());
create policy annonce_envois_admin on annonce_envois for select to authenticated using (est_admin());

-- moteur d'envoi : au plus 150 emails par passage, plus ancienne annonce
-- non terminée d'abord ; se marque terminée quand tout le monde est servi
create or replace function envoyer_annonces() returns void
language plpgsql security definer set search_path = public as $$
declare
  a record;
  v record;
  envoyes int := 0;
begin
  select * into a from annonces where not terminee order by cree_le limit 1;
  if a is null then return; end if;

  for v in
    select p.id, p.prenom, u.email
    from profiles p
    join auth.users u on u.id = p.id
    where p.statut_compte = 'valide'
      and not exists (select 1 from annonce_envois e
                      where e.annonce_id = a.id and e.profile_id = p.id)
    limit 150
  loop
    perform envoyer_email(
      v.email, v.prenom,
      a.sujet,
      gabarit_email(a.sujet, replace(a.corps, chr(10), '<br>'), 'Ouvrir le site',
                    'https://lsno-alumni.vercel.app'));
    insert into annonce_envois (annonce_id, profile_id) values (a.id, v.id)
      on conflict do nothing;
    envoyes := envoyes + 1;
  end loop;

  if envoyes = 0 then
    update annonces set terminee = true where id = a.id;
  end if;
  raise notice 'Annonce % : % envois ce passage', a.id, envoyes;
end $$;

-- publication par un admin : crée l'annonce et lance la première salve
create or replace function admin_publie_annonce(p_sujet text, p_corps text) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not est_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  if exists (select 1 from annonces where not terminee) then
    raise exception 'Une annonce est déjà en cours d''envoi — attends qu''elle se termine.';
  end if;
  insert into annonces (sujet, corps, cree_par) values (trim(p_sujet), trim(p_corps), auth.uid())
    returning id into v_id;
  perform envoyer_annonces();
  return v_id;
end $$;

-- la suite s'envoie toute seule, chaque jour à 11h (rien si file vide)
select cron.schedule('envoi-annonces', '0 11 * * *', $$select envoyer_annonces()$$);

-- Vérification : select jobname from cron.job;  -- 8 jobs désormais
