-- ============================================================
-- Migration 72 — tour des nouveautés
--   Deux repères sur le profil : la version du tour de bienvenue déjà vue
--   (0 = jamais) et les pastilles « Nouveau » déjà découvertes. Portés par
--   le compte, pas par l'appareil. Chacun ne modifie que les siens. Rejouable.
-- ============================================================
alter table profiles add column if not exists tour_version integer not null default 0;
alter table profiles add column if not exists decouvertes  text[]  not null default '{}';
grant update (tour_version, decouvertes) on profiles to authenticated;   -- la politique profils_maj_soi limite à sa propre ligne

-- Vérification :
--   select column_name from information_schema.columns where table_name = 'profiles' and column_name in ('tour_version', 'decouvertes');   -- 2
