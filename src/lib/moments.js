// Les Moments — une photo ou une vidéo courte qui vit 24 h, 3 jours ou
// 7 jours (migration 64). Fichiers dans le bucket public « medias », sous
// <uuid>/moment-<horodatage>.<ext>, purgés par le cron avec le moment.
import { creerClientNavigateur } from "@/lib/supabase/client";
import { compresserImage, urlMedia, BUCKET_MEDIAS, VIDEO_MO, VIDEO_SECONDES } from "@/lib/fil";

export const DUREES = [
  { heures: 24, nom: "24 h", aide: "disparaît demain à la même heure" },
  { heures: 72, nom: "3 jours", aide: "le bon réglage pour un réseau qu'on n'ouvre pas tous les jours" },
  { heures: 168, nom: "7 jours", aide: "une semaine, pour un événement à ne pas rater" },
];
export const DUREE_DEFAUT = 72;
export const LEGENDE_MAX = 200;
export const SECONDES_PHOTO = 5;    // durée d'affichage d'une photo dans le lecteur
export { VIDEO_MO, VIDEO_SECONDES };

export async function chargerRail() {
  const supabase = creerClientNavigateur();
  const { data, error } = await supabase.rpc("rail_moments");
  if (error) throw error;
  return (data ?? []).map((a) => ({
    ...a,
    moments: (a.moments ?? []).map((m) => ({ ...m, url: urlMedia(m.media_chemin) })),
  }));
}

export async function momentsNonVus() {
  const supabase = creerClientNavigateur();
  const { data, error } = await supabase.rpc("moments_non_vus");
  if (error) throw error;
  return data ?? 0;
}

export async function publierMoment({ fichier, type, legende = "", visibilite = "tous", duree = DUREE_DEFAUT }) {
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  const estVideo = type === "video";
  const corps = estVideo ? fichier : await compresserImage(fichier);
  const ext = estVideo ? (fichier.name.split(".").pop() || "mp4").toLowerCase().slice(0, 5) : "jpg";
  const chemin = `${user.id}/moment-${Date.now()}.${ext}`;
  const up = await supabase.storage.from(BUCKET_MEDIAS).upload(chemin, corps, { contentType: estVideo ? fichier.type : "image/jpeg" });
  if (up.error) throw up.error;
  const { data, error } = await supabase.from("moments")
    .insert({ auteur: user.id, media_chemin: chemin, media_type: estVideo ? "video" : "photo", legende: legende.trim(), visibilite, duree_heures: duree })
    .select("id").single();
  if (error) {
    await supabase.storage.from(BUCKET_MEDIAS).remove([chemin]);
    throw error;
  }
  return data.id;
}

export async function supprimerMoment(m) {
  const supabase = creerClientNavigateur();
  await supabase.storage.from(BUCKET_MEDIAS).remove([m.media_chemin]);
  const { error } = await supabase.from("moments").delete().eq("id", m.id);
  if (error) throw error;
}

// marquer vu : silencieux, une seule fois par membre (clé primaire)
export async function marquerVu(momentId) {
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("moment_vues").upsert({ moment_id: momentId, membre: user.id }, { onConflict: "moment_id,membre", ignoreDuplicates: true });
}

export async function bravoMoment(momentId) {
  const supabase = creerClientNavigateur();
  const { data, error } = await supabase.rpc("basculer_bravo", { p_type: "moment", p_id: String(momentId) });
  if (error) throw error;
  return data;
}

export async function vuesDe(momentId) {
  const supabase = creerClientNavigateur();
  const { data, error } = await supabase.rpc("vues_moment", { p_id: momentId });
  if (error) throw error;
  return data ?? [];
}

export async function modererMoment(momentId, masque) {
  const supabase = creerClientNavigateur();
  const { error } = await supabase.rpc("moderer_moment", { p_id: momentId, p_masque: masque });
  if (error) throw error;
}

// « expire dans 5 h », « expire dans 2 j »
export function expireDans(date) {
  const s = Math.max(0, (new Date(date).getTime() - Date.now()) / 1000);
  if (s < 3600) return `expire dans ${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `expire dans ${Math.round(s / 3600)} h`;
  return `expire dans ${Math.round(s / 86400)} j`;
}
