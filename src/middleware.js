import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Rafraîchit la session Supabase et protège les pages membres :
// sans connexion, tout sauf les pages publiques redirige vers /connexion.
const PUBLIQUES = ["/", "/connexion", "/inscription", "/a-propos", "/mot-de-passe/oubli", "/mot-de-passe/nouveau"];

export async function middleware(req) {
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(liste) {
          liste.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          liste.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    }
  );

  // getClaims : vérifie le jeton LOCALEMENT (signature ES256) — pas d'appel
  // réseau vers Supabase à chaque navigation. Sur mobile hésitant, l'ancien
  // getUser() expirait parfois et éjectait des membres pourtant connectés.
  let connecte = false;
  try {
    const { data } = await supabase.auth.getClaims();
    connecte = Boolean(data?.claims);
  } catch {
    // vérification impossible (réseau) : on laisse passer — la RLS de la
    // base reste le vrai gardien des données, le middleware n'est que l'UX.
    connecte = true;
  }

  const chemin = req.nextUrl.pathname;
  const publique = PUBLIQUES.includes(chemin);
  if (!connecte && !publique) {
    const url = req.nextUrl.clone();
    url.pathname = "/connexion";
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  // exclut les internes Next, les images ET tout fichier statique
  // (robots.txt, sitemap.xml, vérification Google… : chemins avec extension)
  matcher: ["/((?!_next/static|_next/image|img/|.*\\..*).*)"],
};
