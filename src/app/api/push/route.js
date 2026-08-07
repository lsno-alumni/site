import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

// Émetteur des notifications push — appelé PAR LA BASE (pg_net → envoyer_push).
// Auto-hébergé : la signature VAPID et le chiffrement se font ici, aucun tiers.
// Protégé par un secret partagé (en-tête x-cle-push) ; jamais accessible aux
// visiteurs. Tourne en Node (web-push a besoin des modules crypto natifs) —
// Node est le runtime PAR DÉFAUT avec Cache Components activé, plus besoin
// de le déclarer (le déclarer devient même une erreur de build).

export async function POST(requete) {
  const secret = process.env.PUSH_SECRET;
  if (!secret || requete.headers.get("x-cle-push") !== secret) {
    return Response.json({ erreur: "refuse" }, { status: 401 });
  }

  // « profil » (un seul) ou « profils » (lot — les diffusions à tout le réseau
  // arrivent par paquets de 50 pour rester loin de la limite de temps Vercel)
  const { profil, profils, titre, corps, url, groupe, famille } = await requete.json();
  const cibles = Array.isArray(profils) ? profils : profil ? [profil] : [];
  if (!cibles.length || !titre) return Response.json({ erreur: "incomplet" }, { status: 400 });

  webpush.setVapidDetails(
    "mailto:lsno.alumni@gmail.com",
    process.env.VAPID_PUBLIC,
    process.env.VAPID_PRIVATE
  );

  // clé service_role : nécessaire pour lire les abonnements des AUTRES membres
  // (la RLS ne laisse chacun voir que les siens) ; côté serveur uniquement.
  const base = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  const { data: abonnements, error } = await base
    .from("push_abonnements")
    .select("id, endpoint, p256dh, auth")
    .in("profil", cibles);
  if (error) return Response.json({ erreur: error.message }, { status: 500 });

  // « famille » sert au service worker à regrouper (réseau, offres) au-delà du seuil
  const charge = JSON.stringify({ titre, corps: corps ?? "", url: url ?? "/", groupe, famille });
  const perimes = [];
  let envoyes = 0;

  await Promise.all((abonnements ?? []).map(async (a) => {
    try {
      await webpush.sendNotification(
        { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
        charge
      );
      envoyes++;
    } catch (e) {
      // 404/410 = l'appareil a désinstallé l'appli ou révoqué l'autorisation
      if (e.statusCode === 404 || e.statusCode === 410) perimes.push(a.id);
    }
  }));

  if (perimes.length) await base.from("push_abonnements").delete().in("id", perimes);

  return Response.json({ envoyes, retires: perimes.length });
}
