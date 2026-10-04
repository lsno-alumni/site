// Messages — lecture et écriture côté navigateur (client Supabase du membre :
// la RLS et les RPC de la migration 53 font foi). Temps réel par Supabase
// Realtime sur la table messages.
import { creerClientNavigateur } from "@/lib/supabase/client";
import { exigerProfilComplet } from "@/lib/profilComplet";
import { compresserImage } from "@/lib/fil";
import { avecReprise } from "@/lib/erreurs";

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
const CHAMPS_MESSAGE = "id, auteur, texte, cree_le, mentions, reponse_a, modifie_le, fichier_chemin, fichier_type, fichier_nom, fichier_taille, fichier_expiree, fichier_duree, sondage_id, transfere";
// tant que la migration 77 (fichier_duree) n'est pas passée : mêmes lectures sans la colonne
const CHAMPS_SANS_DUREE = CHAMPS_MESSAGE.replace("fichier_duree, ", "");
const sansColonne = (e) => e?.code === "42703";

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
  await exigerProfilComplet();   // « dis d'abord qui tu es » : ouvre la feuille si le profil n'a pas le minimum (migration 84)
  const supabase = creerClientNavigateur();
  const { data, error } = await supabase.rpc("ouvrir_duo", { p_autre: autreId });
  if (error) throw error;
  return data;
}

export async function creerGroupe(nom, membres, reglages = null) {
  await exigerProfilComplet();   // « dis d'abord qui tu es » : ouvre la feuille si le profil n'a pas le minimum (migration 84)
  const supabase = creerClientNavigateur();
  const { data, error } = await supabase.rpc("creer_groupe", { p_nom: nom, p_membres: membres });
  if (error) throw error;
  // accès et cercle (migration 68) : posés juste après, par le créateur
  if (reglages && (reglages.acces !== "prive" || reglages.visibilite !== "tous")) {
    const { error: e2 } = await supabase.from("conversations").update({ acces: reglages.acces ?? "prive", visibilite: reglages.visibilite ?? "tous" }).eq("id", data);
    if (e2) throw e2;
  }
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
  const champs = (recu) => `id, type, nom, photo_url, description, message_epingle, cree_par, acces, visibilite, officiel, membres:conversation_membres(membre, lu_le,${recu ? " recu_le," : ""} muet, epingle, profil:profiles(id, prenom, nom, photo_url))`;
  let { data, error } = await supabase.from("conversations").select(champs(true)).eq("id", id).maybeSingle();
  // tant que la migration 76 (recu_le) n'est pas passée : même lecture sans la colonne
  if (error?.code === "42703") ({ data, error } = await supabase.from("conversations").select(champs(false)).eq("id", id).maybeSingle());
  if (error) throw error;
  return data;
}

export async function chargerMessages(conversationId, { limite = 50, avant = null } = {}) {
  const supabase = creerClientNavigateur();
  const requete = (champs) => {
    let req = supabase.from("messages").select(champs)
      .eq("conversation_id", conversationId).order("cree_le", { ascending: false }).limit(limite);
    return avant ? req.lt("cree_le", avant) : req;
  };
  let { data, error } = await requete(CHAMPS_MESSAGE);
  if (sansColonne(error)) ({ data, error } = await requete(CHAMPS_SANS_DUREE));
  if (error) throw error;
  return (data ?? []).reverse();   // du plus ancien au plus récent
}

export async function envoyerMessage(conversationId, texte, mentions = [], piece = null, reponseA = null, sondageId = null, extra = {}) {
  await exigerProfilComplet();   // « dis d'abord qui tu es » : ouvre la feuille si le profil n'a pas le minimum (migration 84)
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  const ligne = { conversation_id: conversationId, auteur: user.id, texte: texte.trim(), mentions, reponse_a: reponseA, sondage_id: sondageId, ...extra };
  if (piece) Object.assign(ligne, { fichier_chemin: piece.chemin, fichier_type: piece.type, fichier_nom: piece.nom, fichier_taille: piece.taille });
  if (piece && Number.isFinite(piece.duree)) ligne.fichier_duree = Math.max(0, Math.round(piece.duree));
  let { data, error } = await supabase.from("messages").insert(ligne).select(CHAMPS_MESSAGE).single();
  if (sansColonne(error) && "fichier_duree" in ligne) { delete ligne.fichier_duree; ({ data, error } = await supabase.from("messages").insert(ligne).select(CHAMPS_SANS_DUREE).single()); }
  if (error) {
    if (piece) await supabase.storage.from(BUCKET_PIECES).remove([piece.chemin]);
    throw error;
  }
  return data;
}

// la pièce part d'abord dans le bucket privé : « <conversation>/<moi>/<horodatage>.<ext> »
export async function televerserPiece(conversationId, { type, fichier, duree = null }) {
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  const corps = type === "photo" ? await compresserImage(fichier) : fichier;
  const ext = type === "photo" ? "jpg" : type === "pdf" ? "pdf" : (fichier.name.split(".").pop() || "mp4").toLowerCase().slice(0, 5);
  // une coupure pendant l'envoi (« problème de réseau », 03/10) : on reprend
  // jusqu'à trois fois avant d'abandonner, sous un nouveau nom à chaque fois
  // (un premier envoi arrivé à moitié ne bloque pas la reprise)
  const chemin = await avecReprise(async () => {
    const c = `${conversationId}/${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET_PIECES).upload(c, corps, {
      contentType: type === "photo" ? "image/jpeg" : type === "pdf" ? "application/pdf" : fichier.type,
    });
    if (error) throw error;
    return c;
  }, { essais: 3, delai: 1200 });
  return { chemin, type, nom: type === "photo" ? "photo.jpg" : fichier.name.slice(0, 120), taille: corps.size ?? fichier.size, duree };
}

// URL signées (1 h) pour afficher les pièces d'une conversation ; { chemin: url }.
// Gardées 50 min, en mémoire ET dans localStorage : une adresse qui ne change
// pas à chaque entrée, c'est une image que le navigateur (et le service worker)
// peut resservir sans la retélécharger — ce qui change tout en 3G.
const CLE_URLS = "lsno_urls_pieces";
const DUREE_URL_MS = 50 * 60 * 1000;
const cacheUrls = new Map();   // chemin → { url, exp }
(() => {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE_URLS) || "{}");
    const now = Date.now();
    for (const [chemin, v] of Object.entries(brut)) if (v?.exp > now) cacheUrls.set(chemin, v);
  } catch { /* pas de localStorage (serveur, navigation privée) */ }
})();
function garderUrls() {
  try {
    const now = Date.now(); const obj = {};
    for (const [chemin, v] of cacheUrls) if (v.exp > now) obj[chemin] = v;
    localStorage.setItem(CLE_URLS, JSON.stringify(obj));
  } catch { /* idem */ }
}
// ce qu'on connaît déjà, sans attendre : pour afficher une conversation revisitée d'un coup
export function urlsConnues(chemins) {
  const now = Date.now(); const out = {};
  for (const c of chemins ?? []) { const v = cacheUrls.get(c); if (v && v.exp > now) out[c] = v.url; }
  return out;
}
export async function urlsPieces(chemins) {
  const now = Date.now();
  const out = {};
  const manquants = [];
  for (const c of new Set(chemins.filter(Boolean))) {
    const v = cacheUrls.get(c);
    if (v && v.exp > now) out[c] = v.url; else manquants.push(c);
  }
  if (!manquants.length) return out;
  const supabase = creerClientNavigateur();
  const { data, error } = await supabase.storage.from(BUCKET_PIECES).createSignedUrls(manquants, 3600);
  for (const d of data ?? []) if (d.signedUrl && !d.error) { out[d.path] = d.signedUrl; cacheUrls.set(d.path, { url: d.signedUrl, exp: now + DUREE_URL_MS }); }
  garderUrls();
  if (error) throw error;   // coupure réseau : l'appelant garde la liste des manquants et réessaie
  return out;
}

// un message supprimé en direct : son fichier quitte aussi le cache des médias du service worker
export function oublierMedia(chemin) {
  if (!chemin || typeof caches === "undefined") return;
  caches.open("lsno-medias-v1").then(async (c) => {
    for (const k of await c.keys()) if (new URL(k.url).pathname.endsWith("/" + chemin)) await c.delete(k);
  }).catch(() => {});
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
  return abonner(supabase, () => supabase.channel("reactions-" + suffixe())
    .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, (p) => surChangement?.(p)), null);
}

// ---- « vu » : la date de lecture des autres membres bouge en temps réel ----
export function ecouterLecture(conversationId, surMaj, surReprise = null) {
  const supabase = creerClientNavigateur();
  return abonner(supabase, () => supabase.channel(`lecture-${conversationId}-${suffixe()}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversation_membres", filter: `conversation_id=eq.${conversationId}` },
      (p) => surMaj?.(p.new)), surReprise);
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
  return abonner(supabase, () => supabase.channel(`modifs-${conversationId}-${suffixe()}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
      (p) => surMaj?.(p.new)), null);
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
  let { data, error } = await supabase.from("messages").select(CHAMPS_MESSAGE).eq("id", id).maybeSingle();
  if (sansColonne(error)) ({ data } = await supabase.from("messages").select(CHAMPS_SANS_DUREE).eq("id", id).maybeSingle());
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
// ---- groupes qu'on peut rejoindre (migration 68) ----
export const ACCES = [
  { cle: "prive", nom: "Privé", aide: "on y entre sur invitation d’un membre" },
  { cle: "demande", nom: "Sur demande", aide: "visible dans « Découvrir des groupes », tu acceptes qui entre" },
  { cle: "ouvert", nom: "Ouvert", aide: "visible, on entre d’un tap" },
];
export async function groupesVisibles(q = "") {
  const supabase = creerClientNavigateur();
  const { data, error } = await supabase.rpc("groupes_visibles", { p_q: q || null });
  if (error) throw error;
  return data ?? [];
}
export async function rejoindreGroupe(id) {
  const supabase = creerClientNavigateur();
  const { data, error } = await supabase.rpc("rejoindre_groupe", { p_id: id });
  if (error) throw error;
  return data;   // "membre" ou "demande"
}
export async function retirerDemandeGroupe(id) {
  const supabase = creerClientNavigateur();
  const { error } = await supabase.rpc("retirer_demande_groupe", { p_id: id });
  if (error) throw error;
}
export async function demandesGroupe(id) {
  const supabase = creerClientNavigateur();
  const { data, error } = await supabase.rpc("demandes_groupe", { p_id: id });
  if (error) throw error;
  return data ?? [];
}
export async function traiterDemandeGroupe(id, membre, accepter) {
  const supabase = creerClientNavigateur();
  const { error } = await supabase.rpc("traiter_demande_groupe", { p_id: id, p_membre: membre, p_accepter: accepter });
  if (error) throw error;
}

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
  return abonner(supabase, () => supabase.channel("votes-" + suffixe())
    .on("postgres_changes", { event: "*", schema: "public", table: "sondage_votes" }, (p) => surChangement?.(p)), null);
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
  return envoyerMessage(versConversationId, m.texte ?? "", [], piece, null, m.sondage_id ?? null, { transfere: true });
}

// ---- la conversation elle-même (renommage, photo, description, message
//      épinglé, suppression du groupe) et ses membres, en temps réel ----
export function ecouterConversation(conversationId, { surMaj, surSuppression, surMembres }) {
  const supabase = creerClientNavigateur();
  return abonner(supabase, () => supabase.channel(`conv-${conversationId}-${suffixe()}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations", filter: `id=eq.${conversationId}` }, (p) => surMaj?.(p.new))
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "conversations", filter: `id=eq.${conversationId}` }, () => surSuppression?.())
    .on("postgres_changes", { event: "*", schema: "public", table: "conversation_membres", filter: `conversation_id=eq.${conversationId}` },
      (p) => { if (p.eventType !== "UPDATE") surMembres?.(p.eventType, p.new ?? p.old); }), null);
}

// pour la LISTE : toute conversation qui change (nom, photo, ajout ou départ d'un membre, groupe supprimé)
export function ecouterConversations(surChangement, surReprise = null) {
  const supabase = creerClientNavigateur();
  return abonner(supabase, () => supabase.channel("convs-" + suffixe())
    .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, (p) => surChangement?.(p))
    .on("postgres_changes", { event: "*", schema: "public", table: "conversation_membres" }, (p) => surChangement?.(p)), surReprise);
}

export function tailleLisible(o) {
  if (!o) return "";
  return o < 1024 * 1024 ? `${Math.max(1, Math.round(o / 1024))} Ko` : `${(o / 1048576).toFixed(1)} Mo`;
}

export async function marquerLu(conversationId) {
  const supabase = creerClientNavigateur();
  await supabase.rpc("marquer_lu", { p_conversation: conversationId });
}
// « reçu » (deux coches grises chez l'expéditeur) : mon appli a eu le message
// en main — en direct où que je sois, ou à l'ouverture (migration 76)
export async function marquerRecu(conversationId) {
  if (!conversationId) return;
  const supabase = creerClientNavigateur();
  await supabase.rpc("marquer_recu", { p_conversation: conversationId }).then(() => {}, () => {});
}
export async function marquerRecuTout() {
  const supabase = creerClientNavigateur();
  await supabase.rpc("marquer_recu_tout").then(() => {}, () => {});
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

// ============================================================
// Temps réel : les leçons du 03/10 (messages jamais reçus d'un côté)
//  - Le temps réel n'est pas garanti : sur un réseau capricieux, la connexion
//    WebSocket met parfois 30 s à s'établir, tombe et se rétablit, et un
//    téléphone la coupe en arrière-plan. Ce qui est arrivé PENDANT ces trous ne
//    sera jamais poussé : à chaque (ré)abonnement, `surReprise` prévient l'écran
//    pour qu'il relise ce qu'il a pu manquer.
//  - Le canal doit partir AVEC le jeton de session. Au chargement, l'abonnement
//    partait parfois avant que le client temps réel ait reçu le jeton : le
//    serveur vérifiait les droits en anonyme et refusait (« Unable to subscribe
//    to changes with given parameters »), et le canal restait muet jusqu'à la
//    reconnexion suivante.
//  - Un canal refusé ou sans réponse est RECRÉÉ et réessayé (3 s, 8 s, 20 s) :
//    un canal déjà joint ne peut pas être rejoint.
//  - Chaque abonnement porte un NOM UNIQUE : deux abonnements au même nom sur
//    une même connexion (écran monté deux fois) se faisaient refuser. Les canaux
//    de diffusion « frappe » gardent leur nom partagé : c'est lui qui relie les
//    participants.
//  - UN SEUL canal par écran (ecouterToutConversation, ecouterListe) : sept
//    abonnements partaient d'un coup à l'ouverture d'une conversation.
// ============================================================
const suffixe = () => Math.random().toString(36).slice(2, 8);
// `creer` fabrique le canal avec ses écouteurs. Renvoie la fonction d'arrêt.
const abonner = (supabase, creer, surReprise) => {
  let arrete = false, essais = 0, minuteur = null, canal = null;
  const brancher = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) await supabase.realtime.setAuth(session.access_token);
    } catch { /* sans session : on tente quand même */ }
    if (arrete) return;
    canal = creer();
    canal.subscribe((etat) => {
      if (arrete) return;
      if (etat === "SUBSCRIBED") { essais = 0; surReprise?.(); }
      else if (etat === "CHANNEL_ERROR" || etat === "TIMED_OUT") {
        const delai = [3000, 8000, 20000][Math.min(essais++, 2)];
        clearTimeout(minuteur);
        minuteur = setTimeout(() => { if (arrete) return; const vieux = canal; canal = null; supabase.removeChannel(vieux); brancher(); }, delai);
      }
    });
  };
  brancher();
  return () => { arrete = true; clearTimeout(minuteur); if (canal) supabase.removeChannel(canal); };
};

// s'abonner aux nouveaux messages (et suppressions) d'une conversation ;
// renvoie la fonction de désabonnement
export function ecouterMessages(conversationId, { surInsertion, surSuppression, surReprise }) {
  const supabase = creerClientNavigateur();
  return abonner(supabase, () => supabase.channel(`messages-${conversationId}-${suffixe()}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
      (p) => surInsertion?.(p.new))
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
      (p) => surSuppression?.(p.old?.id)), surReprise);
}

// UN SEUL canal pour toute la conversation ouverte (messages, modifications,
// lectures, réactions, votes, la conversation et ses membres)
export function ecouterToutConversation(conversationId, h) {
  const supabase = creerClientNavigateur();
  const filtre = `conversation_id=eq.${conversationId}`;
  return abonner(supabase, () => supabase.channel(`conversation-${conversationId}-${suffixe()}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: filtre }, (p) => h.surInsertion?.(p.new))
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages", filter: filtre }, (p) => h.surSuppression?.(p.old?.id))
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: filtre }, (p) => h.surModification?.(p.new))
    .on("postgres_changes", { event: "*", schema: "public", table: "conversation_membres", filter: filtre },
      (p) => { if (p.eventType === "UPDATE") h.surLecture?.(p.new); else h.surMembres?.(p.eventType, p.new ?? p.old); })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations", filter: `id=eq.${conversationId}` }, (p) => h.surMaj?.(p.new))
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "conversations", filter: `id=eq.${conversationId}` }, () => h.surSuppressionConv?.())
    .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, (p) => h.surReaction?.(p))
    .on("postgres_changes", { event: "*", schema: "public", table: "sondage_votes" }, (p) => h.surVote?.(p)), h.surReprise);
}

// UN SEUL canal pour la liste des conversations : messages, conversations, membres
export function ecouterListe(surChangement, surReprise = null) {
  const supabase = creerClientNavigateur();
  return abonner(supabase, () => supabase.channel("liste-" + suffixe())
    .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (p) => surChangement?.(p))
    .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, (p) => surChangement?.(p))
    .on("postgres_changes", { event: "*", schema: "public", table: "conversation_membres" }, (p) => surChangement?.(p)), surReprise);
}

// tous les nouveaux messages qui me concernent (la RLS ne laisse passer que
// ceux de mes conversations) : pour la liste et la pastille de l'onglet
export function ecouterTousMessages(surInsertion, surReprise = null) {
  const supabase = creerClientNavigateur();
  return abonner(supabase, () => supabase.channel("messages-tous-" + suffixe())
    .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (p) => surInsertion?.(p.new ?? p.old, p.eventType)), surReprise);
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
