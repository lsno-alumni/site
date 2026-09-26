"use client";

import { useEffect, useLayoutEffect } from "react";
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
//     interne (avant que Next remonte en haut) et restaurée lors d'un vrai
//     retour arrière OU d'un tap sur la barre d'onglets (depuis le 26/09 :
//     chaque onglet retrouve sa position, comme dans une appli) — via
//     <RestaurerDefilement /> posé dans les pages concernées. Un lien
//     ordinaire (une fiche, « voir tous les conseils »…) mène toujours en
//     haut de la page visée.
//
// État au niveau MODULE : il survit aux navigations client et repart de zéro
// à un vrai rechargement — exactement ce qu'on veut.
// ============================================================

let profondeur = 0;   // navigations internes depuis l'ouverture de l'onglet
let premier = true;
let retourLe = 0;     // horodatage du dernier retour arrière (popstate)
let ongletLe = 0;     // horodatage du dernier tap sur la barre d'onglets
let sautLe = 0;       // horodatage du dernier saut de position PROGRAMMÉ (restauration)
const positions = new Map();
const affichages = new Map();   // section -> mode d'affichage choisi
// chemin d'un onglet (/annuaire) -> dernière adresse complète vue (avec
// recherche et filtres) : la barre d'onglets y ramène, pas à la page nue
const adressesOnglets = new Map();

const DELAI_RETOUR = 2000; // ms : fenêtre pendant laquelle on considère « retour »
const cleCourante = () => window.location.pathname + window.location.search;
const estRetour = () => Date.now() - retourLe < DELAI_RETOUR;
const estViaOnglet = () => Date.now() - ongletLe < DELAI_RETOUR;

export function peutRevenir() {
  return profondeur > 0;
}

// Dernière adresse complète d'un onglet (filtres et recherche compris), ou
// undefined si l'onglet n'a pas encore été visité dans cette session.
export function derniereAdresse(chemin) {
  return adressesOnglets.get(chemin);
}

// La barre d'onglets se range quand on DESCEND dans la page ; une restauration
// de position est un saut programmé vers le bas, pas un geste du doigt — elle
// ne doit pas la faire disparaître (TabBar.js l'interroge).
export function sautRecent() {
  return Date.now() - sautLe < 500;
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
      adressesOnglets.set(window.location.pathname, cleCourante());
      if (a.closest("nav.tabbar")) ongletLe = Date.now();
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

// À poser dans une page dont on veut retrouver la position exacte au retour
// arrière ou au retour par la barre d'onglets. Ne fait rien si l'on arrive
// par un lien ordinaire ou une adresse tapée.
export function RestaurerDefilement() {
  // useLayoutEffect : on se replace AVANT la première peinture, la page
  // apparaît directement à la bonne position (avec useEffect + deux frames,
  // le haut de page s'affichait puis DÉFILAIT jusqu'à la position — jugé
  // fatigant). `behavior: "instant"` : sans lui, le `scroll-behavior: smooth`
  // global de la page anime le saut.
  useLayoutEffect(() => {
    if (!estRetour() && !estViaOnglet()) return;
    const y = positions.get(cleCourante());
    // les liens de la barre d'onglets portent scroll={false} (sinon Next
    // ramène en haut APRÈS nous, en glissant) : sans position mémorisée,
    // c'est donc ici qu'on part du haut, d'un coup
    if (!y) { if (estViaOnglet()) window.scrollTo({ top: 0, behavior: "instant" }); return; }
    // quelques essais espacés si la page est encore trop courte (blocs
    // chargés en différé, ex. Notifications de Mon profil) — on s'arrête
    // dès que le doigt bouge
    let essais = 0, doigt = false;
    const geste = () => { doigt = true; };
    window.addEventListener("touchstart", geste, { passive: true, once: true });
    window.addEventListener("wheel", geste, { passive: true, once: true });
    const tenter = () => {
      if (doigt) return;
      sautLe = Date.now();
      window.scrollTo({ top: y, behavior: "instant" });
      if (window.scrollY < y - 2 && essais++ < 6) setTimeout(tenter, 150);
    };
    tenter();
  }, []);
  return null;
}
