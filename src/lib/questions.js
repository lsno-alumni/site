// Questions aux anciens — côté navigateur (RLS et RPC de la migration 59).
import { creerClientNavigateur } from "@/lib/supabase/client";
import { exigerProfilComplet } from "@/lib/profilComplet";
import { compresserImage } from "@/lib/fil";

export const PIECE_QUESTION_JOURS = 14;
export const PIECE_PDF_MO = 10;
export function urlPieceQuestion(chemin) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/medias/${chemin}`;
}

export const FILTRES_QUESTIONS = [
  { cle: "toutes", nom: "Toutes" },
  { cle: "sans_reponse", nom: "Sans réponse" },
  { cle: "ouvertes", nom: "Ouvertes" },
  { cle: "resolues", nom: "Résolues" },
  { cle: "miennes", nom: "Les miennes" },
];

export async function listeQuestions({ filtre = "toutes", theme = null, limite = 20, avant = null, q = null } = {}) {
  const supabase = creerClientNavigateur();
  const { data, error } = await supabase.rpc("liste_questions", { p_filtre: filtre, p_theme: theme, p_limite: limite, p_avant: avant, p_q: q || null });
  if (error) throw error;
  return data ?? [];
}

export async function lireQuestion(id) {
  const supabase = creerClientNavigateur();
  const { data, error } = await supabase.rpc("lire_question", { p_id: Number(id) });
  if (error) throw error;
  return data;
}

// la pièce d'une question : photo réduite ou PDF, dans le bucket public
// « medias » (dossier de l'auteur), gardée 14 jours
export async function televerserPieceQuestion(fichier) {
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  const pdf = fichier.type === "application/pdf";
  if (pdf && fichier.size > PIECE_PDF_MO * 1048576) throw new Error(`PDF trop lourd, ${PIECE_PDF_MO} Mo au maximum.`);
  const corps = pdf ? fichier : await compresserImage(fichier);
  const chemin = `${user.id}/q-${Date.now()}.${pdf ? "pdf" : "jpg"}`;
  const { error } = await supabase.storage.from("medias").upload(chemin, corps, { contentType: pdf ? "application/pdf" : "image/jpeg" });
  if (error) throw error;
  return { fichier_chemin: chemin, fichier_type: pdf ? "pdf" : "photo", fichier_nom: pdf ? fichier.name.slice(0, 120) : "photo.jpg", fichier_taille: corps.size ?? fichier.size };
}

export async function poserQuestion({ titre, details, theme, domaine, anonyme, piece = null }) {
  await exigerProfilComplet();   // « dis d'abord qui tu es » : ouvre la feuille si le profil n'a pas le minimum (migration 84)
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("questions")
    .insert({ auteur: user.id, titre: titre.trim(), details: (details ?? "").trim(), theme: theme || null, domaine: domaine || null, anonyme: !!anonyme, ...(piece ?? {}) })
    .select("id").single();
  if (error) {
    if (piece?.fichier_chemin) await supabase.storage.from("medias").remove([piece.fichier_chemin]);
    throw error;
  }
  return data.id;
}

export async function modifierQuestion(id, champs) {
  const supabase = creerClientNavigateur();
  const { error } = await supabase.from("questions").update(champs).eq("id", id);
  if (error) throw error;
}

export async function supprimerQuestion(id) {
  const supabase = creerClientNavigateur();
  const { error } = await supabase.from("questions").delete().eq("id", id);
  if (error) throw error;
}

export async function repondre(questionId, texte) {
  await exigerProfilComplet();   // « dis d'abord qui tu es » : ouvre la feuille si le profil n'a pas le minimum (migration 84)
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("reponses")
    .insert({ question_id: questionId, auteur: user.id, texte: texte.trim() }).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function modifierReponse(id, texte) {
  const supabase = creerClientNavigateur();
  const { error } = await supabase.from("reponses").update({ texte: texte.trim() }).eq("id", id);
  if (error) throw error;
}

export async function supprimerReponse(id) {
  const supabase = creerClientNavigateur();
  const { error } = await supabase.from("reponses").delete().eq("id", id);
  if (error) throw error;
}

// l'auteur retient une réponse (ou la déretient) ; retenir résout la question
export async function retenirReponse(questionId, reponseId) {
  const supabase = creerClientNavigateur();
  const { error } = await supabase.from("questions")
    .update({ meilleure_reponse: reponseId, resolue: !!reponseId }).eq("id", questionId);
  if (error) throw error;
}

export async function modererQuestion(type, id, masquee) {
  const supabase = creerClientNavigateur();
  const { error } = await supabase.rpc(type === "question" ? "moderer_question" : "moderer_reponse", { p_id: Number(id), p_masquee: masquee });
  if (error) throw error;
}
