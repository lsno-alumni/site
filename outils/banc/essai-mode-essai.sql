-- Essai au banc : mode essai des notifications (migration 63).
--   npm run banc -- outils/banc/essai-mode-essai.sql
-- Trois membres : A admin, B compte de test, C membre ordinaire. Mode éteint :
-- les trois sont gardés. Mode actif : C disparaît des cibles.

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@essai', '{"prenom":"Ana","nom":"A","promotion":3}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@essai', '{"prenom":"Bob","nom":"B","promotion":2}'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@essai', '{"prenom":"Cléo","nom":"C","promotion":2}');
update profiles set statut_compte = 'valide' where id in
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000003');
update profiles set role = 'admin' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
insert into push_essai_comptes (profil) values ('bbbbbbbb-0000-0000-0000-000000000002');

select 'mode éteint' as essai, array_length(push_cibles_essai(array[
  'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000003']::uuid[]), 1) as cibles;

update reglages set actif = true where cle = 'push_mode_essai';
select 'mode actif' as essai, push_cibles_essai(array[
  'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000003']::uuid[]) as cibles;
select 'mode actif, que C' as essai, push_cibles_essai(array['cccccccc-0000-0000-0000-000000000003']::uuid[]) is null as personne;

update reglages set actif = false where cle = 'push_mode_essai';
select 'mode éteint à nouveau' as essai, array_length(push_cibles_essai(array['cccccccc-0000-0000-0000-000000000003']::uuid[]), 1) as cibles;

-- gestion depuis l'interface (migration 70) : A (admin) ajoute puis retire C
select set_config('essai.uid', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
select admin_essai_ajouter('cccccccc-0000-0000-0000-000000000003');
select 'admin ajoute C' as essai, json_array_length(admin_essai_comptes()) as comptes;
select admin_essai_retirer('cccccccc-0000-0000-0000-000000000003');
select 'admin retire C' as essai, json_array_length(admin_essai_comptes()) as comptes;
reset role;
select set_config('essai.uid', 'bbbbbbbb-0000-0000-0000-000000000002', false);
set role authenticated;
do $$ begin
  begin
    perform admin_essai_ajouter('cccccccc-0000-0000-0000-000000000003');
    raise exception 'un membre ordinaire a pu ajouter un compte de test';
  exception when others then
    if sqlerrm like '%administrateurs%' then raise notice 'refusé comme attendu'; else raise; end if;
  end;
end $$;
reset role;
