// La bibliothèque « Annales et sujets » (migration 82). Les fichiers vivent
// sur le Google Drive de l'association (déposés par le site via
// /api/bibliotheque/depot) ou derrière un lien externe ; la base garde la
// fiche et son état (en_attente → publie / refuse). Lecture et écriture par
// quatre fonctions, aucun droit de table.
export const TYPES = {
  annale: "Annale du bac",
  devoir: "Devoir / composition",
  cours: "Cours",
  corrige: "Corrigé",
  autre: "Autre",
};
export const CLASSES = { bac: "Bac", terminale: "Terminale", premiere: "Première", seconde: "Seconde" };
export const MATIERES = [
  "Mathématiques", "Physique-Chimie", "SVT", "Français", "Philosophie", "Anglais",
  "Histoire-Géographie", "Informatique", "Allemand", "Espagnol", "EPS", "Autre",
];
export const TAILLE_MAX_MO = 50;        // un scan d'annales dépasse rarement 20 Mo
export const MORCEAU = 3 * 1024 * 1024; // 3 Mo par morceau : sous la limite d'une requête Vercel (4,5 Mo), multiple de 256 Ko (exigence Drive)

export const libelleType = (t) => TYPES[t] ?? t;
export const libelleClasse = (c) => CLASSES[c] ?? c;
export const tailleLisible = (o) => (!o ? "" : o < 1048576 ? `${Math.max(1, Math.round(o / 1024))} Ko` : `${(o / 1048576).toFixed(1).replace(".", ",")} Mo`);

export async function listeBibliotheque(supabase, statut = "publie") {
  const { data, error } = await supabase.rpc("bibliotheque_liste", { p_statut: statut });
  if (error) throw error;
  return data ?? [];
}

export async function proposerDocument(supabase, f) {
  const { data, error } = await supabase.rpc("bibliotheque_proposer", {
    p_titre: f.titre, p_type: f.type, p_matiere: f.matiere, p_classe: f.classe, p_annee: Number(f.annee),
    p_serie: f.serie || null, p_description: f.description || null, p_lien: f.lien, p_drive_id: f.drive_id ?? null, p_taille: f.taille ?? null,
  });
  if (error) throw error;
  return data;
}

// publier / refuser ; si un fichier Drive doit disparaître (refus), le serveur s'en charge
export async function modererDocument(supabase, id, decision, motif = null) {
  const { data: driveId, error } = await supabase.rpc("bibliotheque_moderer", { p_id: id, p_decision: decision, p_motif: motif });
  if (error) throw error;
  if (driveId) await supprimerFichierDrive(driveId);
}

export async function supprimerDocument(supabase, id) {
  const { data: driveId, error } = await supabase.rpc("bibliotheque_supprimer", { p_id: id });
  if (error) throw error;
  if (driveId) await supprimerFichierDrive(driveId);
}

async function supprimerFichierDrive(driveId) {
  try { await fetch("/api/bibliotheque/supprimer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: driveId }) }); }
  catch { /* la fiche est retirée ; un fichier qui traîne sur le Drive n'est pas bloquant */ }
}

// --- dépôt d'un fichier sur le Drive de l'association, par morceaux ---------
// Renvoie { lien, drive_id, taille }. `surProgres(0..1)` pour la barre.
export async function deposerFichier(fichier, surProgres) {
  const appel = async (corps, entetes = {}) => {
    const r = await fetch("/api/bibliotheque/depot", { method: "POST", headers: entetes, body: corps });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.erreur || `Dépôt refusé (${r.status})`); e.code = j.code; throw e; }
    return j;
  };
  const { session } = await appel(JSON.stringify({ action: "debut", nom: fichier.name, taille: fichier.size, type: fichier.type || "application/pdf" }), { "content-type": "application/json" });
  let position = 0; let fini = null;
  while (position < fichier.size) {
    const fin = Math.min(position + MORCEAU, fichier.size);
    const r = await appel(fichier.slice(position, fin), {
      "content-type": "application/octet-stream",
      "x-session": session, "x-debut": String(position), "x-fin": String(fin - 1), "x-total": String(fichier.size),
    });
    position = fin;
    surProgres?.(position / fichier.size);
    if (r.fichier) fini = r.fichier;
  }
  if (!fini?.id) throw new Error("Le dépôt ne s'est pas terminé.");
  const { lien } = await appel(JSON.stringify({ action: "fin", id: fini.id }), { "content-type": "application/json" });
  return { lien, drive_id: fini.id, taille: fichier.size };
}
