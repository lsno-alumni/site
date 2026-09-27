// Le Fil — lecture et écriture côté navigateur (client Supabase du membre,
// la RLS et les RPC de la migration 52 font foi). Le fil mêle les
// publications à des cartes AUTOMATIQUES (arrivées, offres, conseils) pour
// ne jamais paraître vide.
import { creerClientNavigateur } from "@/lib/supabase/client";

export const BUCKET_MEDIAS = "medias";
export const VIDEO_SECONDES = 30;
export const VIDEO_MO = 20;
export const VIDEO_JOURS = 14;
const PHOTO_MAX = 1280;   // px, grand côté

// Qui voit une publication. La base filtre (politique publications_lecture) ;
// ici seulement les libellés.
export const VISIBILITES = [
  { cle: "tous",    nom: "Tout le réseau", court: null,      aide: "visible par tous les membres" },
  { cle: "promo",   nom: "Ma promo",       court: "Promo",   aide: "visible par ta promo seulement" },
  { cle: "domaine", nom: "Mon domaine",    court: "Domaine", aide: "visible par les membres de ton domaine" },
];

export function urlMedia(chemin) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET_MEDIAS}/${chemin}`;
}

// « il y a 5 min », « il y a 2 h », « hier », « il y a 3 j », puis la date
export function depuis(date) {
  const s = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  const j = Math.floor(s / 86400);
  if (j === 1) return "hier";
  if (j < 7) return `il y a ${j} j`;
  return new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// ---- lecture ----

export async function chargerFil({ limite = 20, avant = null } = {}) {
  const supabase = creerClientNavigateur();
  const limite60 = new Date(Date.now() - 60 * 86400000).toISOString();
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const [pubs, arrivees, offres, conseils, questions, evenements] = await Promise.all([
    supabase.rpc("fil_publications", { p_limite: limite, p_avant: avant }),
    avant ? Promise.resolve({ data: [] }) : supabase
      .from("profiles")
      .select("id, prenom, nom, photo_url, domaine, domaine_precision, ville, valide_le, promotions(numero)")
      .eq("statut_compte", "valide")
      .gte("valide_le", new Date(Date.now() - 30 * 86400000).toISOString())
      .order("valide_le", { ascending: false }).limit(10),
    avant ? Promise.resolve({ data: [] }) : supabase
      .from("offres")
      .select("id, type, titre, domaine, pays, ville, date_limite, cree_le, posteur:profiles!offres_posteur_fkey(prenom, nom)")
      .eq("statut", "active")
      .or(`date_limite.gte.${aujourdhui},and(date_limite.is.null,cree_le.gte.${limite60})`)
      .order("cree_le", { ascending: false }).limit(10),
    avant ? Promise.resolve({ data: [] }) : supabase
      .from("profiles")
      .select("id, prenom, nom, photo_url, conseil, conseil_theme, maj_le, promotions(numero)")
      .eq("statut_compte", "valide").not("conseil", "is", null).neq("conseil", "")
      .order("maj_le", { ascending: false }).limit(6),
    avant ? Promise.resolve({ data: [] }) : supabase.rpc("liste_questions", { p_filtre: "toutes", p_theme: null, p_limite: 8, p_avant: null }),
    avant ? Promise.resolve({ data: [] }) : supabase.rpc("liste_evenements", { p_quand: "a_venir", p_limite: 6, p_avant: null }),
  ]);
  if (pubs.error) throw pubs.error;

  const items = [
    ...(pubs.data ?? []).map((p) => ({ type: "publication", id: `p${p.id}`, date: p.cree_le, p })),
    ...(arrivees.data ?? []).map((m) => ({ type: "arrivee", id: `a${m.id}`, date: m.valide_le, m })),
    ...(offres.data ?? []).map((o) => ({ type: "offre", id: `o${o.id}`, date: o.cree_le, o })),
    ...(questions.data ?? []).filter((q) => !q.masquee).map((q) => ({ type: "question", id: `q${q.id}`, date: q.cree_le, q })),
    ...(evenements.data ?? []).filter((e) => !e.masque && !e.annule).map((e) => ({ type: "evenement", id: `e${e.id}`, date: e.cree_le, e })),
  ].sort((x, y) => new Date(y.date) - new Date(x.date));

  // un conseil toutes les 5 cartes (leur date n'est pas parlante) — ordre
  // mélangé mais stable sur la journée
  const cs = [...(conseils.data ?? [])];
  const graine = Math.floor(Date.now() / 86400000);
  cs.sort((a, b) => ((a.id.charCodeAt(0) + graine) % 7) - ((b.id.charCodeAt(0) + graine) % 7));
  let k = 0;
  for (let i = 4; i < items.length && k < cs.length; i += 6) {
    items.splice(i, 0, { type: "conseil", id: `c${cs[k].id}`, date: items[i - 1].date, c: cs[k] });
    k++;
  }
  if (items.length && k < cs.length && items.length < 5) items.push({ type: "conseil", id: `c${cs[k].id}`, date: null, c: cs[k] });
  return { items, dernierePub: pubs.data?.length ? pubs.data[pubs.data.length - 1].cree_le : null, fin: (pubs.data ?? []).length < limite };
}

export async function lirePublication(id) {
  const supabase = creerClientNavigateur();
  const { data, error } = await supabase.rpc("fil_publications", { p_limite: 50, p_avant: null });
  if (error) throw error;
  return (data ?? []).find((p) => String(p.id) === String(id)) ?? null;
}

export async function commentairesDe(type, id) {
  const supabase = creerClientNavigateur();
  const { data, error } = await supabase.rpc("commentaires_de", { p_type: type, p_id: String(id) });
  if (error) throw error;
  return data ?? [];
}

export async function bravosDe(type, id) {
  const supabase = creerClientNavigateur();
  const { data } = await supabase.rpc("bravos_de", { p_type: type, p_id: String(id) });
  return data ?? { bravos: 0, jai_bravo: false, commentaires: 0 };
}

// ---- écriture ----

export async function basculerBravo(type, id) {
  const supabase = creerClientNavigateur();
  const { data, error } = await supabase.rpc("basculer_bravo", { p_type: type, p_id: String(id) });
  if (error) throw error;
  return data;
}

export async function envoyerCommentaire(type, id, texte, reponseA = null, mentions = []) {
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("commentaires").insert({
    cible_type: type, cible_id: String(id), auteur: user.id, texte: texte.trim(), reponse_a: reponseA, mentions,
  });
  if (error) throw error;
}

export async function modifierCommentaire(id, texte, mentions = []) {
  const supabase = creerClientNavigateur();
  const { error } = await supabase.from("commentaires").update({ texte: texte.trim(), mentions }).eq("id", id);
  if (error) throw error;
}

export async function supprimerCommentaire(id) {
  const supabase = creerClientNavigateur();
  const { error } = await supabase.from("commentaires").delete().eq("id", id);
  if (error) throw error;
}

export async function signaler(type, id, motif) {
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("signalements").insert({ cible_type: type, cible_id: String(id), auteur: user.id, motif: motif.trim() });
  if (error && error.code !== "23505") throw error;   // déjà signalé par ce membre : on considère que c'est fait
}

export async function moderer(type, id, masque) {
  const supabase = creerClientNavigateur();
  const fn = type === "publication" ? "moderer_publication" : "moderer_commentaire";
  const args = type === "publication" ? { p_id: Number(id), p_masquee: masque } : { p_id: Number(id), p_masque: masque };
  const { error } = await supabase.rpc(fn, args);
  if (error) throw error;
}

// la photo est réduite sur le téléphone avant l'envoi (grand côté 1280 px, JPEG)
export function compresserImage(fichier) {
  return new Promise((ok, ko) => {
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onload = () => {
      const r = Math.min(1, PHOTO_MAX / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? ok(b) : ko(new Error("compression impossible"))), "image/jpeg", 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); ko(new Error("image illisible")); };
    img.src = url;
  });
}

export const PHOTOS_MAX = 10;   // photos par publication

// les photos d'une publication, dans l'ordre : la colonne photos (plusieurs)
// ou l'ancienne photo unique (media_chemin)
export function photosDe(p) {
  if (p.photos?.length) return p.photos.map(urlMedia);
  if (p.media_type === "photo" && p.media_chemin) return [urlMedia(p.media_chemin)];
  return [];
}

export async function publier({ texte, media, photos = [], visibilite = "tous", mentions = [] }) {
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  let media_chemin = null, media_type = null;
  const chemins = [];
  if (photos.length) {
    // chaque photo est réduite puis envoyée ; si l'une échoue, on retire celles déjà envoyées
    const base = Date.now();
    try {
      for (let i = 0; i < Math.min(photos.length, PHOTOS_MAX); i++) {
        const corps = await compresserImage(photos[i]);
        const chemin = `${user.id}/${base}-${i}.jpg`;
        const up = await supabase.storage.from(BUCKET_MEDIAS).upload(chemin, corps, { contentType: "image/jpeg" });
        if (up.error) throw up.error;
        chemins.push(chemin);
      }
    } catch (e) {
      if (chemins.length) await supabase.storage.from(BUCKET_MEDIAS).remove(chemins);
      throw e;
    }
  } else if (media) {
    const estVideo = media.type === "video";
    const corps = estVideo ? media.fichier : await compresserImage(media.fichier);
    const ext = estVideo ? (media.fichier.name.split(".").pop() || "mp4").toLowerCase().slice(0, 5) : "jpg";
    media_chemin = `${user.id}/${Date.now()}.${ext}`;
    const up = await supabase.storage.from(BUCKET_MEDIAS).upload(media_chemin, corps, {
      contentType: estVideo ? media.fichier.type : "image/jpeg",
    });
    if (up.error) throw up.error;
    media_type = estVideo ? "video" : "photo";
  }
  const { data, error } = await supabase.from("publications")
    .insert({ auteur: user.id, texte: texte.trim(), media_chemin, media_type, photos: chemins, visibilite, mentions })
    .select("id").single();
  if (error) {
    const aRetirer = [...chemins, ...(media_chemin ? [media_chemin] : [])];
    if (aRetirer.length) await supabase.storage.from(BUCKET_MEDIAS).remove(aRetirer);
    throw error;
  }
  return data.id;
}

export async function supprimerPublication(p) {
  const supabase = creerClientNavigateur();
  const fichiers = [...(p.photos ?? []), ...(p.media_chemin ? [p.media_chemin] : [])];
  if (fichiers.length) await supabase.storage.from(BUCKET_MEDIAS).remove(fichiers);
  const { error } = await supabase.from("publications").delete().eq("id", p.id);
  if (error) throw error;
}
