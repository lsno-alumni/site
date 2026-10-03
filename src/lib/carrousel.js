// Le carrousel d'À propos : les photos du lycée (dans le code, avec leurs
// titres) puis deux photos par promotion, tenues par ses délégués (table
// carrousel_photos, migration 80). Lecture publique par carrousel_liste() ;
// écriture par carrousel_enregistrer() / carrousel_retirer() ; fichiers dans
// le bucket public « medias », dossier carrousel/promo-<id>/<emplacement>.jpg.
import { urlMedia, compresserImage } from "@/lib/fil";

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

export async function retirerPhotoCarrousel(supabase, promotionId, position) {
  const { error } = await supabase.rpc("carrousel_retirer", { p_promotion: promotionId, p_position: position });
  if (error) throw error;
}
