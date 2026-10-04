import { configure, jetonAcces, appelant, reponse, nonConfigure } from "../drive";

// Dépôt d'un fichier de la bibliothèque sur le Drive de l'association, en
// trois temps, parce qu'une requête Vercel ne peut pas dépasser 4,5 Mo :
//   1. { action: "debut", nom, taille, type }  → ouvre une session d'envoi
//      « resumable » côté Drive, renvoie son adresse ;
//   2. morceau binaire (en-têtes x-session, x-debut, x-fin, x-total) → transmis
//      au Drive avec Content-Range ; 308 = « continue », 200/201 = fichier créé ;
//   3. { action: "fin", id } → le fichier devient lisible par quiconque a le
//      lien (c'est ce que la fiche affichera), renvoie ce lien.
// Réservé aux membres validés. Rien n'est écrit sur le site.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TAILLE_MAX = 50 * 1024 * 1024;
const TYPES_OK = /^(application\/pdf|image\/(jpeg|png|webp)|application\/(msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document))$/;

export async function POST(requete) {
  if (!configure()) return nonConfigure();
  const qui = await appelant();
  if (!qui) return reponse({ erreur: "Réservé aux membres validés." }, 401);
  const type = requete.headers.get("content-type") || "";

  if (type.startsWith("application/json")) {
    const corps = await requete.json().catch(() => ({}));
    if (corps.action === "debut") {
      const nom = String(corps.nom || "document").replace(/[\\/:*?"<>|]+/g, " ").slice(0, 120);
      const taille = Number(corps.taille);
      if (!Number.isFinite(taille) || taille <= 0 || taille > TAILLE_MAX) return reponse({ erreur: `Fichier trop lourd (${Math.round(taille / 1048576)} Mo) : 50 Mo au maximum.` }, 400);
      const mime = TYPES_OK.test(corps.type) ? corps.type : "application/pdf";
      const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true", {
        method: "POST",
        headers: { authorization: `Bearer ${await jetonAcces()}`, "content-type": "application/json; charset=UTF-8", "x-upload-content-type": mime, "x-upload-content-length": String(taille) },
        body: JSON.stringify({ name: nom, parents: [process.env.DRIVE_DOSSIER_ID], mimeType: mime, description: `Proposé sur LSNO Amicale par le membre ${qui.id}` }),
      });
      if (!r.ok) return reponse({ erreur: "Le Drive refuse d'ouvrir l'envoi (" + r.status + ")." }, 502);
      const session = r.headers.get("location");
      if (!session || !session.startsWith("https://www.googleapis.com/")) return reponse({ erreur: "Session d'envoi invalide." }, 502);
      return reponse({ session });
    }
    if (corps.action === "fin") {
      const id = String(corps.id || "");
      if (!/^[\w-]{10,}$/.test(id)) return reponse({ erreur: "Identifiant invalide." }, 400);
      const jeton = await jetonAcces();
      const perm = await fetch(`https://www.googleapis.com/drive/v3/files/${id}/permissions?supportsAllDrives=true`, {
        method: "POST", headers: { authorization: `Bearer ${jeton}`, "content-type": "application/json" },
        body: JSON.stringify({ role: "reader", type: "anyone" }),
      });
      if (!perm.ok) return reponse({ erreur: "Impossible de rendre le fichier lisible (" + perm.status + ")." }, 502);
      const meta = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=id,webViewLink,size&supportsAllDrives=true`, { headers: { authorization: `Bearer ${jeton}` } });
      const j = await meta.json().catch(() => ({}));
      return reponse({ lien: j.webViewLink || `https://drive.google.com/file/d/${id}/view`, taille: Number(j.size) || null });
    }
    return reponse({ erreur: "Action inconnue." }, 400);
  }

  // un morceau
  const session = requete.headers.get("x-session") || "";
  const debut = Number(requete.headers.get("x-debut")), fin = Number(requete.headers.get("x-fin")), total = Number(requete.headers.get("x-total"));
  if (!session.startsWith("https://www.googleapis.com/") || ![debut, fin, total].every(Number.isFinite) || fin < debut || total > TAILLE_MAX) return reponse({ erreur: "Morceau invalide." }, 400);
  const octets = Buffer.from(await requete.arrayBuffer());
  if (octets.length !== fin - debut + 1) return reponse({ erreur: "Taille du morceau inattendue." }, 400);
  const r = await fetch(session, {
    method: "PUT",
    headers: { "content-length": String(octets.length), "content-range": `bytes ${debut}-${fin}/${total}` },
    body: octets,
  });
  if (r.status === 308) return reponse({ fini: false, recu: r.headers.get("range") });
  if (r.ok) { const j = await r.json().catch(() => ({})); return reponse({ fini: true, fichier: { id: j.id, nom: j.name } }); }
  return reponse({ erreur: "Le Drive a refusé un morceau (" + r.status + ")." }, 502);
}
