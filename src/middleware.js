import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Rafraîchit la session Supabase et protège les pages membres :
// sans connexion, tout sauf les pages publiques redirige vers /connexion.
const PUBLIQUES = ["/", "/connexion", "/inscription", "/a-propos", "/conditions", "/bienvenue", "/mot-de-passe/oubli", "/mot-de-passe/nouveau"];

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
  let aal = null;
  let utilisateurId = null;
  try {
    const { data } = await supabase.auth.getClaims();
    connecte = Boolean(data?.claims);
    aal = data?.claims?.aal ?? null;      // "aal1" ou "aal2" — gratuit, dans le jeton
    utilisateurId = data?.claims?.sub ?? null;
  } catch {
    // vérification impossible (réseau) : on laisse passer — la RLS de la
    // base reste le vrai gardien des données, le middleware n'est que l'UX.
    connecte = true;
  }

  // ⚠ Une session « aal1 » est une session VALIDE — mot de passe correct,
  // cookies en règle — mais pour un compte qui a activé la double
  // authentification, ce n'est que la MOITIÉ du parcours : le code n'a
  // jamais été demandé. Sans cette vérification, quitter l'écran du code
  // (bouton « retour », onglet fermé puis rouvert…) sans jamais le saisir
  // suffisait à atterrir sur l'accueil connecté (signalé le 03/08, migration
  // 46). double_auth_active vient de la base (une requête, seulement pour
  // les sessions PAS encore à aal2 — la grande majorité des membres n'a pas
  // activé la protection et n'atteindra jamais aal2, donc ce cas reste
  // fréquent ; échec de la requête = on n'aggrave rien, RLS reste le vrai
  // gardien des données comme au-dessus).
  if (connecte && aal && aal !== "aal2" && utilisateurId) {
    try {
      const { data: profil } = await supabase
        .from("profiles").select("role, double_auth_active")
        .eq("id", utilisateurId).maybeSingle();
      if (profil?.role !== "membre" && profil?.double_auth_active) connecte = false;
    } catch { /* échec de la vérification : on ne bloque pas dessus */ }
  }

  const chemin = req.nextUrl.pathname;
  const publique = PUBLIQUES.includes(chemin);
  if (!connecte && !publique) {
    // les robots d'aperçu (WhatsApp…) peuvent lire les métadonnées d'un
    // profil partagé (vitrine choisie) ; les humains vont à la connexion
    const ua = req.headers.get("user-agent") ?? "";
    const robotApercu = /whatsapp|facebookexternalhit|twitterbot|linkedinbot|telegrambot|slackbot|discordbot|skypeuripreview|pinterestbot/i.test(ua);
    if (robotApercu && (chemin.startsWith("/profil/") || /^\/offres\/\d+/.test(chemin))) return res;
    const url = req.nextUrl.clone();
    url.pathname = "/connexion";
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  // exclut les internes Next, les images, tout fichier statique
  // (robots.txt, sitemap.xml, vérification Google… : chemins avec extension)
  // ET les routes api/ (ex. /api/push, appelée par la base : elle a son propre
  // secret, une redirection vers la connexion la casserait)
  matcher: ["/((?!api/|_next/static|_next/image|img/|.*\\..*).*)"],
};
