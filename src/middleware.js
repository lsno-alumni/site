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

  const { data: { user } } = await supabase.auth.getUser();

  const chemin = req.nextUrl.pathname;
  const publique = PUBLIQUES.includes(chemin);
  if (!user && !publique) {
    const url = req.nextUrl.clone();
    url.pathname = "/connexion";
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|img/).*)"],
};
