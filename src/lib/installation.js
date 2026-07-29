// Aide à l'installation du site comme une appli (PWA).
//
// Deux cas, très différents :
//  • Chrome / Edge / Samsung Internet : le navigateur nous prévient qu'il peut
//    installer (« beforeinstallprompt ») → on affiche NOTRE bouton, qui ouvre la
//    vraie boîte de dialogue du système. Un seul appui, rien à expliquer.
//  • iOS (et Firefox) : aucune API, Apple ne le permet pas → il faut décrire les
//    gestes exacts, sinon les gens ne trouvent pas.
//
// ⚠ Chrome ne propose l'installation que si un SERVICE WORKER est enregistré.
// Le nôtre ne servait qu'aux notifications : il n'était donc actif que pour ceux
// qui les avaient activées, et personne d'autre ne voyait jamais de proposition.
// D'où initInstallation() : on l'enregistre pour tout le monde, au chargement.

let invite = null;        // l'événement mis de côté par le navigateur
let installee = false;    // passée à true si l'installation aboutit
let demarre = false;

export function initInstallation() {
  if (demarre || typeof window === "undefined") return;
  demarre = true;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();          // on garde la main : notre bouton décide du moment
    invite = e;
  });
  window.addEventListener("appinstalled", () => { invite = null; installee = true; });

  // service worker pour tout le monde (condition d'installabilité + prêt pour
  // les notifications si le membre les active ensuite)
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => { /* sans gravité */ });
  }
}

export const inviteDisponible = () => invite !== null;

// ouvre la boîte de dialogue d'installation du navigateur
export async function lancerInstallation() {
  if (!invite) return false;
  invite.prompt();
  const { outcome } = await invite.userChoice;
  invite = null;                 // l'événement ne se rejoue pas
  return outcome === "accepted";
}

// le site tourne-t-il déjà en appli installée ?
export function dejaInstallee() {
  if (typeof window === "undefined") return false;
  if (installee) return true;
  return window.matchMedia?.("(display-mode: standalone)")?.matches
    || window.navigator.standalone === true;   // iOS
}

export function plateforme() {
  if (typeof navigator === "undefined") return "ordinateur";
  const ua = navigator.userAgent;
  // navigateurs intégrés (Facebook, Instagram…) : ils ne savent pas installer
  if (/FBAN|FBAV|Instagram|Line\/|Snapchat/.test(ua)) return "in-app";
  const ios = /iPhone|iPad|iPod/.test(ua)
    || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? "ios-autre" : "ios-safari";
  if (/Android/.test(ua)) {
    if (/Firefox/.test(ua)) return "android-firefox";
    if (/SamsungBrowser/.test(ua)) return "android-samsung";
    return "android-chrome";
  }
  return "ordinateur";
}

// gestes à faire, quand aucun bouton n'est possible
export const MODES = {
  "ios-safari": {
    titre: "Sur iPhone (Safari)",
    etapes: ["Touche le bouton Partager, en bas de l'écran",
             "Fais défiler et choisis « Sur l'écran d'accueil »",
             "Touche « Ajouter » — l'icône LSNO apparaît avec tes applis"],
  },
  "ios-autre": {
    titre: "Sur iPhone, avec un autre navigateur",
    etapes: ["Ce navigateur ne peut pas installer le site : Apple réserve cette possibilité à Safari",
             "Ouvre lsno-alumni.vercel.app dans Safari",
             "Puis Partager › « Sur l'écran d'accueil »"],
  },
  "android-firefox": {
    titre: "Sur Android (Firefox)",
    etapes: ["Ouvre le menu ⋮ en haut à droite",
             "Choisis « Installer » (ou « Ajouter à l'écran d'accueil »)",
             "Confirme — l'icône rejoint tes applis"],
  },
  "android-samsung": {
    titre: "Sur Android (Samsung Internet)",
    etapes: ["Ouvre le menu ☰ en bas à droite",
             "Choisis « Ajouter la page à » puis « Écran d'accueil »",
             "Confirme"],
  },
  "android-chrome": {
    titre: "Sur Android (Chrome)",
    etapes: ["Ouvre le menu ⋮ en haut à droite",
             "Choisis « Installer l'application » ou « Ajouter à l'écran d'accueil »",
             "Confirme"],
  },
  "in-app": {
    titre: "Depuis Facebook, Instagram…",
    etapes: ["Le navigateur intégré à ces applis ne peut pas installer de site",
             "Ouvre le menu ⋮ puis « Ouvrir dans le navigateur »",
             "Recommence depuis Chrome ou Safari"],
  },
  ordinateur: {
    titre: "Sur ordinateur",
    etapes: ["Regarde à droite de la barre d'adresse : une petite icône d'installation apparaît",
             "Sinon, menu ⋮ › « Installer LSNO Amicale »",
             "L'appli s'ouvre alors dans sa propre fenêtre"],
  },
};
