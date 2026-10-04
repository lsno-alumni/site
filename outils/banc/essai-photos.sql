-- Essai au banc : plusieurs photos par publication (migration 62).
--   npm run banc -- outils/banc/essai-photos.sql
-- Une publication sans texte mais avec trois photos passe ; onze photos sont
-- refusées ; une publication vide (ni texte, ni média, ni photo) est refusée ;
-- fil_publications renvoie le tableau photos.

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@essai', '{"prenom":"Ana","nom":"A","promotion":3}');
update profiles set statut_compte = 'valide' where id = 'aaaaaaaa-0000-0000-0000-000000000001';

select set_config('essai.uid', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
insert into publications (auteur, texte, photos) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '', array['a/1.jpg', 'a/2.jpg', 'a/3.jpg']);
select 'trois photos sans texte' as essai, json_array_length(fil_publications(5)->0->'photos') as n;

do $$ begin
  begin
    insert into publications (auteur, texte, photos) values
      ('aaaaaaaa-0000-0000-0000-000000000001', 'trop', array['1','2','3','4','5','6','7','8','9','10','11']);
    raise exception 'onze photos sont passées';
  exception when check_violation then raise notice 'onze photos refusées comme attendu';
  end;
  begin
    insert into publications (auteur, texte) values ('aaaaaaaa-0000-0000-0000-000000000001', '');
    raise exception 'une publication vide est passée';
  exception when check_violation then raise notice 'publication vide refusée comme attendu';
  end;
end $$;
select 'publications en base' as essai, count(*)::int as n from publications;
reset role;
