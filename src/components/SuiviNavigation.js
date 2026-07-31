"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { initInstallation } from "@/lib/installation";

// ============================================================
// Suivi de la navigation interne (monté une fois dans le layout).
//
// Deux services rendus au reste de l'app :
//  1) peutRevenir() — sait-on revenir en arrière DANS l'app ? On ne peut pas
//     se fier à document.referrer : la navigation Next est côté client, donc
//     il ne change jamais (et il est vide si l'on ouvre le site par l'icône
//     PWA ou en tapant l'adresse). On compte donc les navigations internes.
//  2) Le mode d'affichage choisi par le membre (roue ou liste) pour chaque
//     section réglable — pour qu'un aller-retour ne le lui reprenne pas.
//  3) La position de défilement de chaque page, mémorisée AU CLIC sur un lien
//     interne (avant que Next remonte en haut) et restaurée uniquement lors
//     d'un vrai retour arrière — via <RestaurerDefilement /> posé dans les
//     pages concernées (les pages « force-dynamic » se rechargent au retour :
//     il faut attendre que leur contenu soit rendu pour restaurer).
//
// État au niveau MODULE : il survit aux navigations client et repart de zéro
// à un vrai rechargement — exactement ce qu'on veut.
// ============================================================

let profondeur = 0;   // navigations internes depuis l'ouverture de l'onglet
let premier = true;
let retourLe = 0;     // horodatage du dernier retour arrière (popstate)
const positions = new Map();
const affichages = new Map();   // section -> mode d'affichage choisi

const DELAI_RETOUR = 2000; // ms : fenêtre pendant laquelle on considère « retour »
const cleCourante = () => window.location.pathname + window.location.search;
const estRetour = () => Date.now() - retourLe < DELAI_RETOUR;

export function peutRevenir() {
  return profondeur > 0;
}

// Mode d'affichage d'une section (roue / liste). Lu PENDANT le rendu, donc
// vide au premier affichage d'une page : le rendu client reste identique à
// celui du serveur, et le choix ne ressort qu'aux navigations suivantes.
export function lireAffichage(cle) {
  return cle ? affichages.get(cle) : undefined;
}
export function noterAffichage(cle, valeur) {
  if (cle) affichages.set(cle, valeur);
}

export default function SuiviNavigation() {
  const pathname = usePathname();

  useEffect(() => {
    // enregistre le service worker et met de côté la proposition d'installation
    // du navigateur (voir lib/installation.js) — au plus tôt dans la vie de la page
    initInstallation();

    // mémorise la position AVANT de quitter la page (au clic sur un lien interne)
    const auClic = (e) => {
      const a = e.target?.closest?.("a[href]");
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      if (a.target === "_blank" || /^(https?:|mailto:|tel:|#)/.test(href)) return;
      positions.set(cleCourante(), window.scrollY);
    };
    const auRetour = () => {
      profondeur = Math.max(0, profondeur - 1);
      retourLe = Date.now();
    };
    document.addEventListener("click", auClic, true);
    window.addEventListener("popstate", auRetour);
    return () => {
      document.removeEventListener("click", auClic, true);
      window.removeEventListener("popstate", auRetour);
    };
  }, []);

  useEffect(() => {
    if (premier) premier = false;
    else if (!estRetour()) profondeur += 1;
  }, [pathname]);

  return null;
}

// À poser dans une page dont on veut retrouver la position exacte au retour.
// Ne fait rien si l'on arrive autrement (barre d'onglets, lien direct…).
export function RestaurerDefilement() {
  useEffect(() => {
    if (!estRetour()) return;
    const y = positions.get(cleCourante());
    if (!y) return;
    // deux frames : le temps que la liste rendue par le serveur soit peinte
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
  }, []);
  return null;
}
