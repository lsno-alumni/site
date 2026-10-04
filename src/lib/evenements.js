// Les Événements — une rencontre organisée par un membre (migration 66).
// Affiche et photos dans le bucket public « medias », sous
// <uuid>/evt-<horodatage>.jpg.
import { creerClientNavigateur } from "@/lib/supabase/client";
import * as memoire from "@/lib/memoire";
import { compresserImage, urlMedia, BUCKET_MEDIAS } from "@/lib/fil";
import { creerGroupe } from "@/lib/messages";
import { nomPays } from "@/lib/donnees";

export const TITRE_MAX = 120;
export const DESCRIPTION_MAX = 2000;
export const REPONSES = [
  { cle: "oui", nom: "J’y vais", court: "y va" },
  { cle: "peut_etre", nom: "Peut-être", court: "peut-être" },
];

// ---- lecture ----
export async function listeEvenements({ quand = "a_venir", limite = 20, avant = null } = {}) {
  const supabase = creerClientNavigateur();
  const { data, error } = await supabase.rpc("liste_evenements", { p_quand: quand, p_limite: limite, p_avant: avant });
  if (error) throw error;
  return data ?? [];
}
export async function lireEvenement(id) {
  const supabase = creerClientNavigateur();
  const { data, error } = await supabase.rpc("lire_evenement", { p_id: Number(id) });
  if (error) throw error;
  return data ?? null;
}
const oublier = () => { memoire.ecrire("evenements.a_venir", null); memoire.ecrire("evenements.passes", null); memoire.ecrire("fil.items", null); };

// ---- écriture ----
export async function televerserAffiche(fichier) {
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  const corps = await compresserImage(fichier);
  const chemin = `${user.id}/evt-${Date.now()}.jpg`;
  const up = await supabase.storage.from(BUCKET_MEDIAS).upload(chemin, corps, { contentType: "image/jpeg" });
  if (up.error) throw up.error;
  return chemin;
}
export async function creerEvenement(champs) {
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("evenements").insert({ organisateur: user.id, ...champs }).select("id").single();
  if (error) throw error;
  oublier();
  return data.id;
}
export async function modifierEvenement(id, champs) {
  const supabase = creerClientNavigateur();
  const { error } = await supabase.from("evenements").update(champs).eq("id", id);
  if (error) throw error;
  oublier();
}
export async function annulerEvenement(id, annule = true) {
  return modifierEvenement(id, { annule });
}
export async function supprimerEvenement(e) {
  const supabase = creerClientNavigateur();
  const fichiers = [...(e.affiche_chemin ? [e.affiche_chemin] : []), ...(e.photos ?? []).map((f) => f.chemin)];
  if (fichiers.length) await supabase.storage.from(BUCKET_MEDIAS).remove(fichiers);
  const { error } = await supabase.from("evenements").delete().eq("id", e.id);
  if (error) throw error;
  oublier();
}
export async function repondre(evenementId, reponse) {
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  if (!reponse) {
    const { error } = await supabase.from("evenement_reponses").delete().eq("evenement_id", evenementId).eq("membre", user.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("evenement_reponses").upsert({ evenement_id: evenementId, membre: user.id, reponse }, { onConflict: "evenement_id,membre" });
    if (error) throw error;
  }
  oublier();
}
export async function ajouterPhoto(evenementId, fichier) {
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  const corps = await compresserImage(fichier);
  const chemin = `${user.id}/evt-${evenementId}-${Date.now()}.jpg`;
  const up = await supabase.storage.from(BUCKET_MEDIAS).upload(chemin, corps, { contentType: "image/jpeg" });
  if (up.error) throw up.error;
  const { error } = await supabase.from("evenement_photos").insert({ evenement_id: evenementId, auteur: user.id, chemin });
  if (error) { await supabase.storage.from(BUCKET_MEDIAS).remove([chemin]); throw error; }
}
export async function supprimerPhoto(photo) {
  const supabase = creerClientNavigateur();
  await supabase.storage.from(BUCKET_MEDIAS).remove([photo.chemin]);
  const { error } = await supabase.from("evenement_photos").delete().eq("id", photo.id);
  if (error) throw error;
}
export async function modererEvenement(id, masque) {
  const supabase = creerClientNavigateur();
  const { error } = await supabase.rpc("moderer_evenement", { p_id: Number(id), p_masque: masque });
  if (error) throw error;
  oublier();
}
// la discussion de groupe : nommée comme l'événement, avec ceux qui ont répondu
export async function creerDiscussion(e) {
  const membres = (e.participants ?? []).map((p) => p.id);
  return creerGroupe(e.titre.slice(0, 60), membres);
}

// ---- présentation ----
export const urlAffiche = (e) => (e.affiche_chemin ? urlMedia(e.affiche_chemin) : null);
export const urlPhoto = (f) => urlMedia(f.chemin);

const FMT_JOUR = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" });
const FMT_JOUR_LONG = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const FMT_HEURE = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

// « sam. 10 oct. · 18:00 »
export function quand(e) {
  const d = new Date(e.debut);
  return `${FMT_JOUR.format(d)} · ${FMT_HEURE.format(d)}`;
}
// « samedi 10 octobre 2026, de 18:00 à 21:00 »
export function quandLong(e) {
  const d = new Date(e.debut);
  const h = FMT_HEURE.format(d);
  if (e.fin) return `${FMT_JOUR_LONG.format(d)}, de ${h} à ${FMT_HEURE.format(new Date(e.fin))}`;
  return `${FMT_JOUR_LONG.format(d)}, à ${h}`;
}
// « aujourd'hui », « demain », « dans 5 jours », « il y a 2 jours »
export function dansCombien(e) {
  const j = Math.round((new Date(e.debut).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  if (j === 0) return "aujourd’hui";
  if (j === 1) return "demain";
  if (j > 1 && j < 30) return `dans ${j} jours`;
  if (j === -1) return "hier";
  if (j < 0 && j > -30) return `il y a ${-j} jours`;
  return "";
}
export const estPasse = (e) => new Date(e.fin ?? new Date(e.debut).getTime() + 3 * 3600000) < new Date();
export function ou(e) {
  if (e.lieu_type === "en_ligne") return "En ligne";
  return [e.adresse, e.ville, e.pays ? nomPays(e.pays) : ""].filter(Boolean).join(", ");
}

// ---- agenda ----
const ics = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const echap = (t) => String(t ?? "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
export function fichierIcs(e) {
  const fin = e.fin ?? new Date(new Date(e.debut).getTime() + 2 * 3600000).toISOString();
  const url = `${window.location.origin}/evenements/${e.id}`;
  const lignes = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LSNO Amicale//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:evenement-${e.id}@lsno-alumni`, `DTSTAMP:${ics(new Date())}`,
    `DTSTART:${ics(e.debut)}`, `DTEND:${ics(fin)}`, `SUMMARY:${echap(e.titre)}`,
    `DESCRIPTION:${echap((e.description ? e.description + "\n\n" : "") + url)}`,
    `LOCATION:${echap(e.lieu_type === "en_ligne" ? (e.lien || "En ligne") : ou(e))}`, `URL:${url}`,
    "END:VEVENT", "END:VCALENDAR",
  ];
  return new Blob([lignes.join("\r\n")], { type: "text/calendar;charset=utf-8" });
}
export function lienGoogleAgenda(e) {
  const fin = e.fin ?? new Date(new Date(e.debut).getTime() + 2 * 3600000).toISOString();
  const p = new URLSearchParams({
    action: "TEMPLATE", text: e.titre, dates: `${ics(e.debut)}/${ics(fin)}`,
    details: `${e.description ? e.description + "\n\n" : ""}${window.location.origin}/evenements/${e.id}`,
    location: e.lieu_type === "en_ligne" ? (e.lien || "En ligne") : ou(e),
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}
