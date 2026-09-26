// Messages — lecture et écriture côté navigateur (client Supabase du membre :
// la RLS et les RPC de la migration 53 font foi). Temps réel par Supabase
// Realtime sur la table messages.
import { creerClientNavigateur } from "@/lib/supabase/client";
import { compresserImage } from "@/lib/fil";

export const MESSAGE_MAX = 2000;
export const JOURS_CONSERVATION = 30;
export const BUCKET_PIECES = "pieces";      // privé : lecture par URL signée
export const PIECE_VIDEO_SECONDES = 30;
export const PIECE_VIDEO_MO = 20;
export const PIECE_PDF_MO = 10;
export const VOCAL_SECONDES = 60;
export const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
// la grille du « + » (la base accepte n'importe quel emoji court : migration 55)
export const EMOJIS_PLUS = ["🔥", "👏", "🎉", "💯", "😍", "🤣", "😊", "😎", "🤔", "😅", "😭", "😡", "🥳", "🙌", "💪", "🤝", "👌", "✅", "❌", "⭐", "💡", "📚", "🎓", "🏆", "☕", "🍀", "🌍", "🇧🇫", "🕊️", "💬"];
export const MODIF_MINUTES = 5;
// durée de vie des pièces (la base fait foi : messages_avant_insert)
export const JOURS_PIECE = { photo: 30, pdf: 14, video: 7, audio: 7 };
const CHAMPS_MESSAGE = "id, auteur, texte, cree_le, mentions, reponse_a, modifie_le, fichier_chemin, fichier_type, fichier_nom, fichier_taille, fichier_expiree, sondage_id";

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
    .select("id, type, nom, photo_url, description, message_epingle, cree_par, membres:conversation_membres(membre, lu_le, muet, epingle, profil:profiles(id, prenom, nom, photo_url))")
    .eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function chargerMessages(conversationId, { limite = 50, avant = null } = {}) {
  const supabase = creerClientNavigateur();
  let req = supabase.from("messages").select(CHAMPS_MESSAGE)
    .eq("conversation_id", conversationId).order("cree_le", { ascending: false }).limit(limite);
  if (avant) req = req.lt("cree_le", avant);
  const { data, error } = await req;
  if (error) throw error;
  return (data ?? []).reverse();   // du plus ancien au plus récent
}

export async function envoyerMessage(conversationId, texte, mentions = [], piece = null, reponseA = null, sondageId = null) {
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  const ligne = { conversation_id: conversationId, auteur: user.id, texte: texte.trim(), mentions, reponse_a: reponseA, sondage_id: sondageId };
  if (piece) Object.assign(ligne, { fichier_chemin: piece.chemin, fichier_type: piece.type, fichier_nom: piece.nom, fichier_taille: piece.taille });
  const { data, error } = await supabase.from("messages").insert(ligne).select(CHAMPS_MESSAGE).single();
  if (error) {
    if (piece) await supabase.storage.from(BUCKET_PIECES).remove([piece.chemin]);
    throw error;
  }
  return data;
}

// la pièce part d'abord dans le bucket privé : « <conversation>/<moi>/<horodatage>.<ext> »
export async function televerserPiece(conversationId, { type, fichier }) {
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  const corps = type === "photo" ? await compresserImage(fichier) : fichier;
  const ext = type === "photo" ? "jpg" : type === "pdf" ? "pdf" : (fichier.name.split(".").pop() || "mp4").toLowerCase().slice(0, 5);
  const chemin = `${conversationId}/${user.id}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET_PIECES).upload(chemin, corps, {
    contentType: type === "photo" ? "image/jpeg" : type === "pdf" ? "application/pdf" : fichier.type,
  });
  if (error) throw error;
  return { chemin, type, nom: type === "photo" ? "photo.jpg" : fichier.name.slice(0, 120), taille: corps.size ?? fichier.size };
}

// URL signées (1 h) pour afficher les pièces d'une conversation ; { chemin: url }
export async function urlsPieces(chemins) {
  const liste = [...new Set(chemins.filter(Boolean))];
  if (!liste.length) return {};
  const supabase = creerClientNavigateur();
  const { data } = await supabase.storage.from(BUCKET_PIECES).createSignedUrls(liste, 3600);
  const out = {};
  for (const d of data ?? []) if (d.signedUrl && !d.error) out[d.path] = d.signedUrl;
  return out;
}

export async function supprimerMessage(id) {
  const supabase = creerClientNavigateur();
  // le fichier est retiré par la base (déclencheur après suppression)
  const { error } = await supabase.from("messages").delete().eq("id", id);
  if (error) throw error;
}

// un lien interne (offre, publication, profil) envoyé dans une conversation
export function envoyerLien(conversationId, chemin, titre) {
  return envoyerMessage(conversationId, "", [], { chemin, type: "lien", nom: (titre ?? "").slice(0, 120), taille: null });
}

export async function modifierMessage(id, texte, mentions = []) {
  const supabase = creerClientNavigateur();
  const { data, error } = await supabase.from("messages").update({ texte: texte.trim(), mentions }).eq("id", id).select(CHAMPS_MESSAGE).single();
  if (error) throw error;
  return data;
}

// ---- réactions ----
export async function reactionsDe(messageIds) {
  if (!messageIds.length) return [];
  const supabase = creerClientNavigateur();
  const { data } = await supabase.from("message_reactions").select("message_id, membre, emoji").in("message_id", messageIds);
  return data ?? [];
}
export async function reagir(messageId, emoji) {
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  if (!emoji) { await supabase.from("message_reactions").delete().eq("message_id", messageId).eq("membre", user.id); return; }
  const { error } = await supabase.from("message_reactions").upsert({ message_id: messageId, membre: user.id, emoji }, { onConflict: "message_id,membre" });
  if (error) throw error;
}
export function ecouterReactions(surChangement) {
  const supabase = creerClientNavigateur();
  const canal = supabase.channel("reactions-" + Math.random().toString(36).slice(2, 8))
    .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, (p) => surChangement?.(p))
    .subscribe();
  return () => { supabase.removeChannel(canal); };
}

// ---- « vu » : la date de lecture des autres membres bouge en temps réel ----
export function ecouterLecture(conversationId, surMaj) {
  const supabase = creerClientNavigateur();
  const canal = supabase.channel(`lecture-${conversationId}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversation_membres", filter: `conversation_id=eq.${conversationId}` },
      (p) => surMaj?.(p.new))
    .subscribe();
  return () => { supabase.removeChannel(canal); };
}

// ---- « … écrit » : diffusion éphémère, rien en base ----
export function canalFrappe(conversationId, surFrappe) {
  const supabase = creerClientNavigateur();
  const canal = supabase.channel(`frappe-${conversationId}`, { config: { broadcast: { self: false } } })
    .on("broadcast", { event: "frappe" }, (p) => surFrappe?.(p.payload))
    .subscribe();
  return {
    signaler: (payload) => canal.send({ type: "broadcast", event: "frappe", payload }),
    arreter: () => { supabase.removeChannel(canal); },
  };
}

// « … écrit » pour PLUSIEURS conversations (l'onglet Messages) : un canal par
// conversation, sans rien en base ; renvoie la fonction d'arrêt
export function ecouterFrappes(conversationIds, surFrappe) {
  const supabase = creerClientNavigateur();
  const canaux = conversationIds.slice(0, 30).map((cid) =>
    supabase.channel(`frappe-${cid}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "frappe" }, (p) => surFrappe?.(cid, p.payload))
      .subscribe());
  return () => { canaux.forEach((c) => supabase.removeChannel(c)); };
}

// ---- sourdine, épingle ----
export async function reglerConversation(conversationId, champs) {
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("conversation_membres").update(champs).eq("conversation_id", conversationId).eq("membre", user.id);
  if (error) throw error;
}

// ---- modifications en temps réel (message modifié) ----
export function ecouterModifications(conversationId, surMaj) {
  const supabase = creerClientNavigateur();
  const canal = supabase.channel(`modifs-${conversationId}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
      (p) => surMaj?.(p.new))
    .subscribe();
  return () => { supabase.removeChannel(canal); };
}

// ---- recherche ----
export async function chercherMessages(q) {
  const supabase = creerClientNavigateur();
  const { data, error } = await supabase.rpc("chercher_messages", { p_q: q });
  if (error) throw error;
  return data ?? [];
}

// libellé court d'une pièce pour la liste et les citations
export function libellePiece(m) {
  if (m?.sondage && !m?.fichier_type) return `Sondage : ${m.sondage}`;
  if (!m?.fichier_type && !m?.sondage_id) return "";
  if (m.sondage_id && !m.fichier_type) return "Sondage";
  return m.fichier_type === "photo" ? "Photo" : m.fichier_type === "video" ? "Vidéo" : m.fichier_type === "audio" ? "Message vocal"
    : m.fichier_type === "lien" ? `Lien : ${m.fichier_nom ?? ""}` : `Fichier : ${m.fichier_nom ?? "document"}`;
}

// un message précis (le message épinglé, s'il n'est plus dans les 50 chargés)
export async function lireMessage(id) {
  const supabase = creerClientNavigateur();
  const { data } = await supabase.from("messages").select(CHAMPS_MESSAGE).eq("id", id).maybeSingle();
  return data;
}

// ---- blocages ----
export async function mesBlocages() {
  const supabase = creerClientNavigateur();
  const { data } = await supabase.from("blocages").select("bloque");
  return (data ?? []).map((b) => b.bloque);
}
export async function bloquer(membre) {
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("blocages").upsert({ bloqueur: user.id, bloque: membre }, { onConflict: "bloqueur,bloque", ignoreDuplicates: true });
  if (error) throw error;
}
export async function debloquer(membre) {
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("blocages").delete().eq("bloqueur", user.id).eq("bloque", membre);
  if (error) throw error;
}

// ---- signaler un message (le texte est recopié dans le motif : les
//      modérateurs ne lisent pas les conversations) ----
export async function signalerMessage(m, auteurNom) {
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  const extrait = m.texte?.trim() ? `« ${m.texte.trim().slice(0, 160)} »` : libellePiece(m);
  const { error } = await supabase.from("signalements").insert({
    cible_type: "message", cible_id: String(m.id), auteur: user.id,
    motif: `Message de ${auteurNom ?? "un membre"} : ${extrait}`.slice(0, 300),
  });
  if (error && error.code !== "23505") throw error;
}
export async function adminSupprimerMessage(id) {
  const supabase = creerClientNavigateur();
  const { error } = await supabase.rpc("admin_supprimer_message", { p_id: Number(id) });
  if (error) throw error;
}
export async function adminStockage() {
  const supabase = creerClientNavigateur();
  const { data, error } = await supabase.rpc("admin_stockage");
  if (error) throw error;
  return data ?? [];
}

// ---- groupe : photo, description, message épinglé ----
export async function majGroupe(id, champs) {
  const supabase = creerClientNavigateur();
  const { error } = await supabase.from("conversations").update(champs).eq("id", id);
  if (error) throw error;
}
// la photo du groupe va dans le bucket public « medias » (dossier de celui qui l'envoie)
export async function televerserPhotoGroupe(conversationId, fichier) {
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  const corps = await compresserImage(fichier);
  const chemin = `${user.id}/groupe-${conversationId}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("medias").upload(chemin, corps, { contentType: "image/jpeg" });
  if (error) throw error;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/medias/${chemin}`;
}
export async function epinglerMessage(conversationId, messageId) {
  const supabase = creerClientNavigateur();
  const { error } = await supabase.rpc("epingler_message", { p_conversation: conversationId, p_message: messageId });
  if (error) throw error;
}

// ---- sondages ----
export async function creerSondage(conversationId, question, choix, multiple) {
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("sondages")
    .insert({ conversation_id: conversationId, auteur: user.id, question: question.trim(), choix: choix.map((c) => c.trim()).filter(Boolean), multiple })
    .select("id").single();
  if (error) throw error;
  return envoyerMessage(conversationId, "", [], null, null, data.id);
}
export async function lireSondages(ids) {
  if (!ids.length) return { sondages: {}, votes: {} };
  const supabase = creerClientNavigateur();
  const [{ data: s }, { data: v }] = await Promise.all([
    supabase.from("sondages").select("id, question, choix, multiple, auteur").in("id", ids),
    supabase.from("sondage_votes").select("sondage_id, membre, choix").in("sondage_id", ids),
  ]);
  const votes = {};
  for (const x of v ?? []) (votes[x.sondage_id] ??= []).push({ membre: x.membre, choix: x.choix });
  return { sondages: Object.fromEntries((s ?? []).map((x) => [x.id, x])), votes };
}
export async function voter(sondageId, choix) {
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  if (!choix.length) { await supabase.from("sondage_votes").delete().eq("sondage_id", sondageId).eq("membre", user.id); return; }
  const { error } = await supabase.from("sondage_votes").upsert({ sondage_id: sondageId, membre: user.id, choix, maj_le: new Date().toISOString() }, { onConflict: "sondage_id,membre" });
  if (error) throw error;
}
export function ecouterVotes(surChangement) {
  const supabase = creerClientNavigateur();
  const canal = supabase.channel("votes-" + Math.random().toString(36).slice(2, 8))
    .on("postgres_changes", { event: "*", schema: "public", table: "sondage_votes" }, (p) => surChangement?.(p))
    .subscribe();
  return () => { supabase.removeChannel(canal); };
}

// ---- transférer un message vers une autre conversation ----
export async function transfererMessage(m, versConversationId) {
  const supabase = creerClientNavigateur();
  let piece = null;
  if (m.fichier_chemin && !m.fichier_expiree) {
    if (m.fichier_type === "lien") piece = { chemin: m.fichier_chemin, type: "lien", nom: m.fichier_nom, taille: null };
    else {
      const { data: { user } } = await supabase.auth.getUser();
      const ext = m.fichier_chemin.split(".").pop();
      const chemin = `${versConversationId}/${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET_PIECES).copy(m.fichier_chemin, chemin);
      if (error) throw error;
      piece = { chemin, type: m.fichier_type, nom: m.fichier_nom, taille: m.fichier_taille };
    }
  }
  return envoyerMessage(versConversationId, m.texte ?? "", [], piece, null, m.sondage_id ?? null);
}

export function tailleLisible(o) {
  if (!o) return "";
  return o < 1024 * 1024 ? `${Math.max(1, Math.round(o / 1024))} Ko` : `${(o / 1048576).toFixed(1)} Mo`;
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

// tous les nouveaux messages qui me concernent (la RLS ne laisse passer que
// ceux de mes conversations) : pour la liste et la pastille de l'onglet
export function ecouterTousMessages(surInsertion) {
  const supabase = creerClientNavigateur();
  const canal = supabase.channel("messages-tous-" + Math.random().toString(36).slice(2, 8))
    .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (p) => surInsertion?.(p.new ?? p.old, p.eventType))
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
