// Le Google Drive de l'association (compte lsno.alumni), vu du serveur du site.
// Identifiants dans les variables d'environnement Vercel :
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET — l'identifiant OAuth créé dans la console Google Cloud ;
//   GOOGLE_REFRESH_TOKEN — obtenu une fois en se connectant avec le compte de l'association
//                          (outils/drive-jeton.mjs) ; portée « drive.file » : le site ne voit
//                          que les fichiers qu'il a lui-même créés, rien d'autre du Drive ;
//   DRIVE_DOSSIER_ID — le dossier « Bibliothèque » où tout est rangé.
// Sans ces variables, les routes répondent 503 « drive_non_configure » et le
// formulaire propose un lien à la place.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const configure = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN && process.env.DRIVE_DOSSIER_ID);

let jeton = { valeur: null, expire: 0 };
export async function jetonAcces() {
  if (jeton.valeur && Date.now() < jeton.expire - 60_000) return jeton.valeur;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: process.env.GOOGLE_REFRESH_TOKEN, grant_type: "refresh_token" }),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error("Google refuse le jeton : " + (j.error_description || j.error || r.status));
  jeton = { valeur: j.access_token, expire: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return jeton.valeur;
}

// qui appelle ? un membre validé (ou un modérateur si `moderateur`), d'après les cookies de session
export async function appelant({ moderateur = false } = {}) {
  const magasin = await cookies();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: { getAll: () => magasin.getAll(), setAll: () => {} },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase.from("profiles").select("id, role, statut_compte").eq("id", user.id).maybeSingle();
  if (!p || p.statut_compte !== "valide") return null;
  if (moderateur && !["delegue", "admin"].includes(p.role)) return null;
  return p;
}

export const reponse = (corps, status = 200) => Response.json(corps, { status });
export const nonConfigure = () => reponse({ erreur: "Le dépôt de fichiers n'est pas encore branché sur le Drive de l'association.", code: "drive_non_configure" }, 503);
