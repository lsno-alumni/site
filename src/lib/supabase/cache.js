import { createClient } from "@supabase/supabase-js";

// Client SANS session, pour les lectures mises en cache par `use cache` :
// cette directive interdit d'appeler cookies() en son sein (donc pas le
// client serveur habituel, qui en a besoin pour la session) — et un appel
// mis en cache n'a de sens QUE si son résultat est identique pour tout le
// monde. On reproduit donc nous-mêmes, en clair dans chaque requête, EXACTEMENT
// le même filtre que la politique RLS aurait appliqué (jamais une donnée en
// plus) : sûr uniquement pour les lectures déjà vérifiées comme telles.
export function creerClientCache() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
