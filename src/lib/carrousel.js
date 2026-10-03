// Le carrousel d'À propos : les photos du lycée (dans le code, avec leurs
// titres) puis deux photos par promotion, tenues par ses délégués (table
// carrousel_photos, migration 80). Lecture publique par carrousel_liste() ;
// écriture par carrousel_enregistrer() / carrousel_retirer() ; fichiers dans
// le bucket public « medias », dossier carrousel/promo-<id>/<emplacement>.jpg.
// Autonome (pas de dépendance au module du fil, absent de la production) :
// adresse publique d'un objet du bucket « medias », et réduction d'une photo
// sur le téléphone avant l'envoi (grand côté 1280 px, JPEG).
const BUCKET_MEDIAS = "medias";
export function urlMedia(chemin) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET_MEDIAS}/${chemin}`;
}
export function compresserImage(fichier, max = 1280) {
  return new Promise((ok, ko) => {
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height));
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

export const PHOTOS_LYCEE = [
  { src: "/img/lsno_enseigne.jpg", titre: "Jardin aux lettres" },
  { src: "/img/lsno_portail.jpg", titre: "Portail du lycée" },
  { src: "/img/lsno_campus.jpg", titre: "Bâtiments de l'administration" },
  { src: "/img/lsno_jardin.jpg", titre: "Lycée, vu de haut" },
  { src: "/img/lsno_hero.jpg", titre: "Des anciens" },
];
export const TITRE_MAX = 60;

// adresse d'une photo : fichier du site (« /img/… ») ou objet du stockage,
// avec la date de mise à jour pour qu'un remplacement se voie tout de suite
export function srcPhoto(p) {
  if (p.chemin.startsWith("/")) return p.chemin;
  return `${urlMedia(p.chemin)}?v=${Date.parse(p.maj_le) || 0}`;
}

// la liste complète pour le carrousel : lycée, puis promos dans l'ordre
export function photosCarrousel(liste) {
  const promos = (liste?.photos ?? []).map((p) => ({ src: srcPhoto(p), titre: p.titre, promo: p.numero }));
  return [...PHOTOS_LYCEE, ...promos];
}

// côté serveur comme côté client : le client Supabase est passé en argument
export async function listeCarrousel(supabase) {
  const { data, error } = await supabase.rpc("carrousel_liste");
  if (error) throw error;
  return data ?? { promotions: [], photos: [] };
}

// --- côté délégué -------------------------------------------------------
export const cheminPhoto = (promotionId, position) => `carrousel/promo-${promotionId}/${position}.jpg`;

export async function televerserPhotoCarrousel(supabase, promotionId, position, fichier) {
  const corps = await compresserImage(fichier);
  const chemin = cheminPhoto(promotionId, position);
  const { error } = await supabase.storage.from("medias").upload(chemin, corps, { contentType: "image/jpeg", upsert: true, cacheControl: "60" });
  if (error) throw error;
  return chemin;
}

export async function enregistrerPhotoCarrousel(supabase, promotionId, position, chemin, titre) {
  const { error } = await supabase.rpc("carrousel_enregistrer", { p_promotion: promotionId, p_position: position, p_chemin: chemin, p_titre: titre.trim() });
  if (error) throw error;
}

// la base retire la ligne et renvoie le chemin du fichier ; le fichier, lui, se supprime par
// l'API Storage (Supabase refuse la suppression directe en SQL — migration 81)
export async function retirerPhotoCarrousel(supabase, promotionId, position) {
  const { data: chemin, error } = await supabase.rpc("carrousel_retirer", { p_promotion: promotionId, p_position: position });
  if (error) throw error;
  if (chemin) await supabase.storage.from("medias").remove([chemin]).catch(() => {});   // la photo n'est plus affichée : un fichier qui traîne n'est pas bloquant
}
