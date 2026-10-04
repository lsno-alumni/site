import { configure, jetonAcces, appelant, reponse, nonConfigure } from "../drive";

// Suppression d'un fichier de la bibliothèque sur le Drive, après un refus ou
// un retrait décidé en base (la base renvoie l'identifiant Drive ; elle ne
// peut pas toucher au stockage elle-même). Modérateurs seulement.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(requete) {
  if (!configure()) return nonConfigure();
  const qui = await appelant({ moderateur: true });
  if (!qui) return reponse({ erreur: "Réservé aux délégués et aux administrateurs." }, 401);
  const { id } = await requete.json().catch(() => ({}));
  if (!/^[\w-]{10,}$/.test(String(id || ""))) return reponse({ erreur: "Identifiant invalide." }, 400);
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true`, { method: "DELETE", headers: { authorization: `Bearer ${await jetonAcces()}` } });
  if (r.status === 204 || r.status === 404) return reponse({ ok: true });
  return reponse({ erreur: "Le Drive refuse la suppression (" + r.status + ")." }, 502);
}
