// Les Moments — une photo ou une vidéo courte qui vit 24 h, 3 jours ou
// 7 jours (migrations 64 et 65). Fichiers dans le bucket public « medias »,
// sous <uuid>/moment-<horodatage>.<ext>, purgés par le cron avec le moment.
import { useEffect, useState } from "react";
import { exigerProfilComplet } from "@/lib/profilComplet";
import { creerClientNavigateur } from "@/lib/supabase/client";
import * as memoire from "@/lib/memoire";
import { compresserImage, urlMedia, BUCKET_MEDIAS, VIDEO_MO, VIDEO_SECONDES } from "@/lib/fil";

export const DUREES = [
  { heures: 24, nom: "24 h", aide: "disparaît demain à la même heure" },
  { heures: 72, nom: "3 jours", aide: "le bon réglage pour un réseau qu'on n'ouvre pas tous les jours" },
  { heures: 168, nom: "7 jours", aide: "une semaine, pour un événement à ne pas rater" },
];
export const DUREE_DEFAUT = 72;
export const LEGENDE_MAX = 200;
export const SECONDES_PHOTO = 5;    // durée d'affichage d'une photo dans le lecteur
export const EMOJIS_MOMENT = ["👏", "❤️", "🔥", "😂", "😮", "🎉"];   // réactions rapides
export { VIDEO_MO, VIDEO_SECONDES };

export async function chargerRail() {
  const supabase = creerClientNavigateur();
  const { data, error } = await supabase.rpc("rail_moments");
  if (error) throw error;
  const rail = (data ?? []).map((a) => ({
    ...a,
    moments: (a.moments ?? []).map((m) => ({ ...m, url: urlMedia(m.media_chemin) })),
  }));
  memoire.ecrire("fil.rail", rail);
  return rail;
}

// qui a un moment en cours (annuaire, profil, accueil) : id → { id du premier
// moment à voir, nouveau }. UNE lecture partagée par tous les composants qui
// le demandent (l'annuaire en affiche 200 d'un coup), rafraîchie au plus
// toutes les 30 s ou sur l'événement lsno:moments.
let carteCache = null;          // Map
let carteLueLe = 0;
let carteEnCours = null;
const carteAbonnes = new Set();
function rafraichirCarte() {
  if (carteEnCours) return carteEnCours;
  carteEnCours = chargerRail()
    .then((r) => { carteCache = depuisRail(r); carteLueLe = Date.now(); carteAbonnes.forEach((f) => f(carteCache)); })
    .catch(() => {})
    .finally(() => { carteEnCours = null; });
  return carteEnCours;
}
export function useAuteursMoments() {
  const [carte, setCarte] = useState(() => carteCache ?? depuisRail(memoire.lire("fil.rail")));
  useEffect(() => {
    carteAbonnes.add(setCarte);
    const t = setTimeout(() => { if (Date.now() - carteLueLe > 30000) rafraichirCarte(); else if (carteCache) setCarte(carteCache); }, 0);
    const sur = () => { carteLueLe = 0; rafraichirCarte(); };
    window.addEventListener("lsno:moments", sur);
    return () => { clearTimeout(t); carteAbonnes.delete(setCarte); window.removeEventListener("lsno:moments", sur); };
  }, []);
  return carte;
}
function depuisRail(rail) {
  const c = new Map();
  for (const a of rail ?? []) {
    const premier = a.moments.find((m) => !m.vu) ?? a.moments[0];
    if (premier) c.set(a.auteur.id, { id: premier.id, nouveau: !a.tout_vu });
  }
  return c;
}

export async function momentsNonVus() {
  const supabase = creerClientNavigateur();
  const { data, error } = await supabase.rpc("moments_non_vus");
  if (error) throw error;
  return data ?? 0;
}

export async function publierMoment({ fichier, type, legende = "", visibilite = "tous", duree = DUREE_DEFAUT, mentions = [] }) {
  await exigerProfilComplet();   // « dis d'abord qui tu es » : ouvre la feuille si le profil n'a pas le minimum (migration 84)
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  const estVideo = type === "video";
  const corps = estVideo ? fichier : await compresserImage(fichier);
  const ext = estVideo ? (fichier.name.split(".").pop() || "mp4").toLowerCase().slice(0, 5) : "jpg";
  const chemin = `${user.id}/moment-${Date.now()}.${ext}`;
  const up = await supabase.storage.from(BUCKET_MEDIAS).upload(chemin, corps, { contentType: estVideo ? fichier.type : "image/jpeg" });
  if (up.error) throw up.error;
  const { data, error } = await supabase.from("moments")
    .insert({ auteur: user.id, media_chemin: chemin, media_type: estVideo ? "video" : "photo", legende: legende.trim(), visibilite, duree_heures: duree, mentions })
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

// « Garder en publication » : le fichier est copié (le moment garde le sien
// jusqu'à sa purge) et une publication naît avec la légende et le même cercle
export async function garderEnPublication(m) {
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  const estVideo = m.media_type === "video";
  const ext = estVideo ? (m.media_chemin.split(".").pop() || "mp4") : "jpg";
  const chemin = `${user.id}/${Date.now()}${estVideo ? "" : "-0"}.${ext}`;
  const cp = await supabase.storage.from(BUCKET_MEDIAS).copy(m.media_chemin, chemin);
  if (cp.error) throw cp.error;
  const ligne = estVideo
    ? { auteur: user.id, texte: m.legende ?? "", media_chemin: chemin, media_type: "video", photos: [], visibilite: m.visibilite, mentions: (m.mentions ?? []).map((x) => x.id) }
    : { auteur: user.id, texte: m.legende ?? "", media_chemin: null, media_type: null, photos: [chemin], visibilite: m.visibilite, mentions: (m.mentions ?? []).map((x) => x.id) };
  const { data, error } = await supabase.from("publications").insert(ligne).select("id").single();
  if (error) { await supabase.storage.from(BUCKET_MEDIAS).remove([chemin]); throw error; }
  memoire.ecrire("fil.items", null);
  return data.id;
}

// marquer vu : silencieux, une seule fois par membre (clé primaire)
export async function marquerVu(momentId) {
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("moment_vues").upsert({ moment_id: momentId, membre: user.id }, { onConflict: "moment_id,membre", ignoreDuplicates: true });
}

// réaction rapide : un emoji par personne ; le même à nouveau = retirée
export async function reagir(momentId, emoji, actuelle) {
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  if (actuelle === emoji) {
    const { error } = await supabase.from("moment_reactions").delete().eq("moment_id", momentId).eq("membre", user.id);
    if (error) throw error;
    return null;
  }
  const { error } = await supabase.from("moment_reactions").upsert({ moment_id: momentId, membre: user.id, emoji }, { onConflict: "moment_id,membre" });
  if (error) throw error;
  return emoji;
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

// « 🔥 2 · ❤️ 1 » pour l'auteur
export function resumeReactions(reactions) {
  const e = Object.entries(reactions ?? {}).sort((a, b) => b[1] - a[1]);
  return e.length ? e.map(([emoji, n]) => `${emoji} ${n}`).join(" · ") : "";
}
