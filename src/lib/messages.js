// Messages — lecture et écriture côté navigateur (client Supabase du membre :
// la RLS et les RPC de la migration 53 font foi). Temps réel par Supabase
// Realtime sur la table messages.
import { creerClientNavigateur } from "@/lib/supabase/client";

export const MESSAGE_MAX = 2000;
export const JOURS_CONSERVATION = 30;

// libellé d'une conversation vu par moi : le nom du groupe, ou l'autre personne
export function nomConversation(c) {
  if (c.type === "groupe") return c.nom || "Groupe";
  const autre = c.membres?.[0];
  return autre ? `${autre.prenom} ${autre.nom}` : "Conversation";
}

export async function mesConversations() {
  const supabase = creerClientNavigateur();
  const { data, error } = await supabase.rpc("mes_conversations");
  if (error) throw error;
  return data ?? [];
}

export async function nonLus() {
  const supabase = creerClientNavigateur();
  const { data } = await supabase.rpc("messages_non_lus");
  return data ?? 0;
}

export async function ouvrirDuo(autreId) {
  const supabase = creerClientNavigateur();
  const { data, error } = await supabase.rpc("ouvrir_duo", { p_autre: autreId });
  if (error) throw error;
  return data;
}

export async function creerGroupe(nom, membres) {
  const supabase = creerClientNavigateur();
  const { data, error } = await supabase.rpc("creer_groupe", { p_nom: nom, p_membres: membres });
  if (error) throw error;
  return data;
}

// les membres validés, pour choisir avec qui parler
export async function membresJoignables() {
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("profiles").select("id, prenom, nom, photo_url, promotions(numero)")
    .eq("statut_compte", "valide").neq("id", user.id).order("prenom");
  if (error) throw error;
  return data ?? [];
}

export async function lireConversation(id) {
  const supabase = creerClientNavigateur();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, type, nom, cree_par, membres:conversation_membres(membre, profil:profiles(id, prenom, nom, photo_url))")
    .eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function chargerMessages(conversationId, { limite = 50, avant = null } = {}) {
  const supabase = creerClientNavigateur();
  let req = supabase.from("messages").select("id, auteur, texte, cree_le, mentions")
    .eq("conversation_id", conversationId).order("cree_le", { ascending: false }).limit(limite);
  if (avant) req = req.lt("cree_le", avant);
  const { data, error } = await req;
  if (error) throw error;
  return (data ?? []).reverse();   // du plus ancien au plus récent
}

export async function envoyerMessage(conversationId, texte, mentions = []) {
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("messages")
    .insert({ conversation_id: conversationId, auteur: user.id, texte: texte.trim(), mentions })
    .select("id, auteur, texte, cree_le, mentions").single();
  if (error) throw error;
  return data;
}

export async function supprimerMessage(id) {
  const supabase = creerClientNavigateur();
  const { error } = await supabase.from("messages").delete().eq("id", id);
  if (error) throw error;
}

export async function marquerLu(conversationId) {
  const supabase = creerClientNavigateur();
  await supabase.rpc("marquer_lu", { p_conversation: conversationId });
}

export async function renommerGroupe(id, nom) {
  const supabase = creerClientNavigateur();
  const { error } = await supabase.from("conversations").update({ nom: nom.trim() }).eq("id", id);
  if (error) throw error;
}

export async function ajouterMembres(conversationId, membres) {
  const supabase = creerClientNavigateur();
  const { error } = await supabase.from("conversation_membres")
    .upsert(membres.map((m) => ({ conversation_id: conversationId, membre: m })), { onConflict: "conversation_id,membre", ignoreDuplicates: true });
  if (error) throw error;
}

export async function retirerMembre(conversationId, membre) {
  const supabase = creerClientNavigateur();
  const { error } = await supabase.from("conversation_membres").delete()
    .eq("conversation_id", conversationId).eq("membre", membre);
  if (error) throw error;
}

export async function supprimerGroupe(id) {
  const supabase = creerClientNavigateur();
  const { error } = await supabase.from("conversations").delete().eq("id", id);
  if (error) throw error;
}

// s'abonner aux nouveaux messages (et suppressions) d'une conversation ;
// renvoie la fonction de désabonnement
export function ecouterMessages(conversationId, { surInsertion, surSuppression }) {
  const supabase = creerClientNavigateur();
  const canal = supabase.channel(`messages-${conversationId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
      (p) => surInsertion?.(p.new))
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
      (p) => surSuppression?.(p.old?.id))
    .subscribe();
  return () => { supabase.removeChannel(canal); };
}

// heure courte pour les bulles ; date pour les séparateurs de jour
export function heure(d) {
  return new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
export function jour(d) {
  const x = new Date(d), auj = new Date();
  const meme = (a, b) => a.toDateString() === b.toDateString();
  if (meme(x, auj)) return "Aujourd'hui";
  const hier = new Date(auj); hier.setDate(auj.getDate() - 1);
  if (meme(x, hier)) return "Hier";
  return x.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}
