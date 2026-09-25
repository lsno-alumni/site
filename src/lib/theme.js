// Thème clair / sombre.
// Trois réglages possibles : « clair », « sombre », ou « auto » (défaut) qui
// suit l'HEURE LOCALE de l'appareil — clair de 6 h à 19 h, sombre le reste du
// temps — et non la préférence du système. Le choix est mémorisé sur
// l'appareil. La feuille de style ne connaît que deux états, posés sur <html>
// dans data-theme ; l'attribut est écrit AVANT le premier rendu par le script
// en ligne du layout (copie de `resoudre`), sinon la page clignoterait.

export const CLE = "lsno-theme";
export const REGLAGES = ["auto", "clair", "sombre"];
export const HEURE_JOUR = 6;
export const HEURE_NUIT = 19;

// même couleur que --fond, pour la barre du navigateur (meta theme-color)
const COULEUR_BARRE = { clair: "#F6F0E4", sombre: "#0F1219" };

export function lireReglage() {
  try {
    const v = localStorage.getItem(CLE);
    return REGLAGES.includes(v) ? v : "auto";
  } catch { return "auto"; }
}

export function resoudre(reglage, date = new Date()) {
  if (reglage === "clair" || reglage === "sombre") return reglage;
  const h = date.getHours();
  return h >= HEURE_JOUR && h < HEURE_NUIT ? "clair" : "sombre";
}

export function appliquer(theme) {
  const racine = document.documentElement;
  if (racine.getAttribute("data-theme") === theme) return;
  racine.setAttribute("data-theme", theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", COULEUR_BARRE[theme]);
}

export function enregistrer(reglage) {
  try { localStorage.setItem(CLE, reglage); } catch { /* stockage indisponible : le choix vaut pour la page */ }
  appliquer(resoudre(reglage));
  window.dispatchEvent(new CustomEvent("lsno-theme", { detail: reglage }));
}

// Script exécuté avant le premier rendu (layout.js) : doit rester autonome,
// sans import — c'est une COPIE de la logique ci-dessus.
export const SCRIPT_INITIAL = `(function(){var t="clair";try{var r=localStorage.getItem("${CLE}");var h=new Date().getHours();t=(r==="clair"||r==="sombre")?r:((h>=${HEURE_JOUR}&&h<${HEURE_NUIT})?"clair":"sombre")}catch(e){}document.documentElement.setAttribute("data-theme",t)})();`;
