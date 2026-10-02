// La version du déploiement en ligne (identifiant du commit sur Vercel).
// L'appli la compare à la sienne pour se recharger quand une nouvelle
// version est sortie (src/lib/version.js).
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { version: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_VERSION ?? "dev" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
