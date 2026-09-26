/** @type {import('next').NextConfig} */

// ---------------------------------------------------------------------------
// En-têtes de sécurité (ajoutés le 31/07).
//
// Tout ce que le site charge est servi par lui-même : les polices sont
// auto-hébergées par next/font, le blason et les drapeaux sont dans /public.
// Seule exception, Supabase — API, temps réel, et les images des deux buckets.
// La politique peut donc être serrée, et l'origine est lue dans
// l'environnement plutôt qu'écrite en dur dans un dépôt public.
//
// Deux honnêtetés à garder en tête :
//
//  • « unsafe-inline » reste nécessaire pour les scripts (Next injecte les
//    siens en ligne pour l'hydratation) et pour les styles (le projet utilise
//    massivement l'attribut style dans le JSX). La CSP n'empêche donc pas tout
//    script injecté. Elle interdit en revanche les scripts venant d'une AUTRE
//    origine, l'encadrement du site dans une iframe, le détournement de la
//    destination des formulaires et les objets embarqués — ce qui reste utile.
//    L'alternative propre (un nonce par requête) obligerait, d'après la doc de
//    cette version, à rendre TOUTES les pages dynamiquement : trop cher pour
//    les pages statiques du site (conditions, à propos, inscription…).
//
//  • En développement, React et Turbopack ont besoin de « unsafe-eval » et
//    d'une connexion websocket locale : la politique y est assouplie, et
//    seulement là.
// ---------------------------------------------------------------------------

// La CSP a été soupçonnée le 01/08 quand « Mon profil » a cessé de s'afficher :
// à tort. La cause était une perte des privilèges de table du rôle authenticated
// (migration 38). Passer ceci à true remet la politique en simple observation
// (Report-Only) — utile pour diagnostiquer sans rien bloquer.
const CSP_OBSERVATION = false;

const dev = process.env.NODE_ENV !== "production";
// Vérification anti-robot : le widget vient de Cloudflare et s'affiche dans une
// iframe. Ses origines ne sont autorisées QUE si une clé est configurée — sans
// clé, la politique reste aussi serrée qu'avant.
const captcha = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  ? " https://challenges.cloudflare.com" : "";
const supabase = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const supabaseWs = supabase.replace(/^https:/, "wss:");

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  `frame-src 'self'${captcha}`,           // l'iframe du widget anti-robot
  "object-src 'none'",
  `img-src 'self' data: blob: ${supabase}`,          // photos et pièces jointes
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${captcha}${dev ? " 'unsafe-eval'" : ""}`,
  `connect-src 'self' ${supabase} ${supabaseWs}${captcha}${dev ? " ws://localhost:* http://localhost:*" : ""}`,
  "font-src 'self' data:",
  "worker-src 'self'",                                // service worker des notifications
  "manifest-src 'self'",
  "media-src 'self'",
  // Note : en testant une build de production EN LOCAL (http://localhost), cette
  // directive fait échouer les préchargements de Next, réécrits en https. C'est
  // un artefact du test local uniquement — en production tout est déjà en https.
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const enTetes = [
  { key: CSP_OBSERVATION ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy", value: csp },
  // frame-ancestors couvre déjà ce cas ; celui-ci sert aux navigateurs anciens
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // aucune de ces capacités n'est utilisée : la photo passe par un champ fichier
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig = {
  // « L'affaire du cache » (26/09). Chaque tap sur un onglet dynamique
  // (accueil, annuaire, conseils, profil, à propos) repartait au serveur, même
  // dix secondes après la visite précédente : ~1 s et un squelette à chaque
  // fois. Ce réglage garde la page reçue 30 s dans le navigateur : l'aller-
  // retour entre onglets devient instantané. C'était le comportement PAR
  // DÉFAUT de Next 14 (passé à 0 en v15) ; encore étiqueté « experimental »
  // en 16.2 mais présent depuis 14.2. Fraîcheur : 30 s au pire pour ce que
  // les AUTRES ont changé ; ce que je change moi-même se voit tout de suite
  // (router.refresh() après chaque écriture). Retirer ces trois lignes = retour
  // à l'état d'avant.
  experimental: { staleTimes: { dynamic: 30, static: 300 } },
  async headers() {
    return [{ source: "/(.*)", headers: enTetes }];
  },
};

export default nextConfig;
