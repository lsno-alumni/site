"use client";

import { creerClientNavigateur } from "@/lib/supabase/client";

// « Pour prendre la parole, dis qui tu es » (migration 84). Le minimum : photo,
// ville, pays, et une ligne de présentation sauf pour un élève. La base tient la
// règle (politiques d'écriture, contacts_de) ; ici, l'écran la connaît à l'avance
// pour ouvrir la feuille « Dis aux anciens qui tu es » AVANT le geste, et le
// reprendre une fois le profil complété.
export const CHAMPS_MINIMUM = {
  photo_url: "ta photo",
  statut_titre: "une ligne de présentation",
  ville: "ta ville",
  pays: "ton pays",
};
const vide = (v) => !v || !String(v).trim();
export function champsMinimum(p) {
  return p?.situation === "eleve" ? ["photo_url", "ville", "pays"] : ["photo_url", "statut_titre", "ville", "pays"];
}
export function manquesMinimum(p) {
  return champsMinimum(p).filter((c) => vide(p?.[c]));
}
export function profilMinimumOk(p) {
  return !!p && manquesMinimum(p).length === 0;
}
export function texteManques(p) {
  const l = manquesMinimum(p).map((c) => CHAMPS_MINIMUM[c]);
  return l.length <= 1 ? l.join("") : l.slice(0, -1).join(", ") + " et " + l[l.length - 1];
}

// ---- mon profil minimal, lu une fois par session ----
let moi = null;
let enCours = null;
export async function lireMoi(forcer = false) {
  if (moi && !forcer) return moi;
  if (!enCours) {
    enCours = (async () => {
      const supabase = creerClientNavigateur();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles")
        .select("id, prenom, nom, photo_url, statut_titre, ville, pays, situation, statut_compte")
        .eq("id", user.id).maybeSingle();
      moi = data ?? null;
      return moi;
    })().finally(() => { enCours = null; });
  }
  return enCours;
}
export function oublierMoi() { moi = null; }

// ---- la garde ----
// Résout quand le profil est complet (tout de suite, ou après la feuille) ;
// rejette avec « profil_incomplet » si la personne remet à plus tard.
export const EVENEMENT = "lsno:completer-profil";
export async function exigerProfilComplet() {
  const p = await lireMoi();
  if (!p) return;                               // pas connecté : la base refusera, inutile d'ouvrir quoi que ce soit
  if (profilMinimumOk(p)) return;
  if (typeof window === "undefined") throw new Error("profil_incomplet");
  return new Promise((resoudre, rejeter) => {
    const detail = {
      profil: p,
      termine: (nouveau) => { moi = nouveau ?? moi; profilMinimumOk(moi) ? resoudre() : rejeter(new Error("profil_incomplet")); },
      annule: () => rejeter(new Error("profil_incomplet")),
    };
    const recu = window.dispatchEvent(new CustomEvent(EVENEMENT, { detail, cancelable: true }));
    if (recu) rejeter(new Error("profil_incomplet"));   // aucun hôte à l'écoute (page sans la feuille) : on refuse proprement
  });
}
export const estProfilIncomplet = (e) => /profil_incomplet/.test(String(e?.message ?? e ?? ""));
