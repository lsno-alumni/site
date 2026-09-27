-- ============================================================
-- Migration 67 — Événements : les fichiers suivent les lignes
--   Une photo déposée par un participant est dans SON dossier du bucket :
--   l'organisateur qui supprime l'événement ne peut pas la retirer depuis
--   l'application (politique du bucket). Le serveur s'en charge : à la
--   suppression d'une ligne (photo, ou événement avec son affiche), le
--   fichier est effacé via pg_net avec la clé service_role du Vault — même
--   mécanique que les purges. Rejouable.
-- ============================================================
create or replace function effacer_fichier_medias(p_chemin text) returns void
language plpgsql security definer set search_path = public as $$
declare cle text;
begin
  if p_chemin is null or p_chemin = '' then return; end if;
  select decrypted_secret into cle from vault.decrypted_secrets where name = 'service_role_key';
  if cle is null then return; end if;
  perform net.http_delete(
    url     := 'https://pdjbqdwurwgxzghehldr.supabase.co/storage/v1/object/medias/' || p_chemin,
    headers := jsonb_build_object('Authorization', 'Bearer ' || cle, 'apikey', cle));
exception when others then
  null;
end $$;
revoke all on function effacer_fichier_medias(text) from public, anon, authenticated;

create or replace function evenement_photos_apres_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform effacer_fichier_medias(old.chemin);
  return old;
end $$;
drop trigger if exists evenement_photos_apres_delete on evenement_photos;
create trigger evenement_photos_apres_delete after delete on evenement_photos
  for each row execute function evenement_photos_apres_delete();

create or replace function evenements_apres_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform effacer_fichier_medias(old.affiche_chemin);
  return old;
end $$;
drop trigger if exists evenements_apres_delete on evenements;
create trigger evenements_apres_delete after delete on evenements
  for each row execute function evenements_apres_delete();

-- Vérification :
--   select tgname from pg_trigger where tgname in ('evenement_photos_apres_delete', 'evenements_apres_delete');   -- 2
