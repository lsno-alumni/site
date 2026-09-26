// Questions aux anciens — côté navigateur (RLS et RPC de la migration 59).
import { creerClientNavigateur } from "@/lib/supabase/client";

export const FILTRES_QUESTIONS = [
  { cle: "toutes", nom: "Toutes" },
  { cle: "sans_reponse", nom: "Sans réponse" },
  { cle: "ouvertes", nom: "Ouvertes" },
  { cle: "resolues", nom: "Résolues" },
  { cle: "miennes", nom: "Les miennes" },
];

export async function listeQuestions({ filtre = "toutes", theme = null, limite = 20, avant = null } = {}) {
  const supabase = creerClientNavigateur();
  const { data, error } = await supabase.rpc("liste_questions", { p_filtre: filtre, p_theme: theme, p_limite: limite, p_avant: avant });
  if (error) throw error;
  return data ?? [];
}

export async function lireQuestion(id) {
  const supabase = creerClientNavigateur();
  const { data, error } = await supabase.rpc("lire_question", { p_id: Number(id) });
  if (error) throw error;
  return data;
}

export async function poserQuestion({ titre, details, theme, domaine, anonyme }) {
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("questions")
    .insert({ auteur: user.id, titre: titre.trim(), details: (details ?? "").trim(), theme: theme || null, domaine: domaine || null, anonyme: !!anonyme })
    .select("id").single();
  if (error) throw error;
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
