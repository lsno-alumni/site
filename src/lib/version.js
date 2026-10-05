"use client";

// Nouvelle version en ligne → l'appli se recharge au prochain moment sans
// risque (tap sur un onglet, retour au premier plan), jamais au milieu d'une
// saisie. Sans ça, une appli installée ou un onglet laissé ouvert gardait le
// code chargé au départ pendant des heures (vu le 02/10 : deux correctifs
// déployés, un téléphone qui tournait toujours sur l'ancien).
// VERSION est figée au build (identifiant du commit sur Vercel) ; /api/version
// répond celle du déploiement en ligne.
export const VERSION = process.env.NEXT_PUBLIC_VERSION ?? "dev";
const INTERVALLE_MS = 60 * 1000;
let nouvelle = false;
let derniere = 0;

// `force` (changement d'écran) : on accepte une vérification toutes les 10 s au lieu de 60
export async function verifierVersion(force = false) {
  if (nouvelle || VERSION === "dev" || Date.now() - derniere < (force ? 10 * 1000 : INTERVALLE_MS)) return nouvelle;
  derniere = Date.now();
  try {
    const r = await fetch("/api/version", { cache: "no-store" });
    const j = await r.json();
    if (j?.version && j.version !== VERSION) nouvelle = true;
  } catch { /* hors ligne : on réessaiera */ }
  return nouvelle;
}

export function nouvelleVersionPrete() { return nouvelle; }

// une saisie en cours ? on ne recharge pas sous les doigts de quelqu'un
export function saisieEnCours() {
  const a = document.activeElement;
  if (a && (a.tagName === "TEXTAREA" || a.tagName === "INPUT") && a.value) return true;
  return !!document.querySelector("textarea:not(:placeholder-shown), input[type=text]:not(:placeholder-shown)");
}
