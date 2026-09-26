"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, ArrowDown, Check } from "lucide-react";

// Glisser vers le bas EN HAUT d'une page pour la recharger — depuis
// N'IMPORTE QUELLE zone statique, tant que la page est déjà tout en haut
// (façon Facebook).
//
// ⚠ Un glissement vers le BAS n'a de sens comme « défilement » que pour
// remonter dans une liste déjà descendue — quand on est DÉJÀ tout en haut,
// glisser vers le bas ne peut RIEN faire défiler (rien au-dessus), donc ce
// geste est TOUJOURS libre pour le rafraîchissement à cet instant précis,
// sans jamais gêner le défilement normal :
//   - descendre dans la liste (glissement du doigt vers le HAUT, à tout
//     moment) : jamais touché — "pan-down" (nom MDN, contre-intuitif : il
//     désigne le geste par le défilement du CONTENU qu'il produit, pas le
//     sens du doigt) reste toujours autorisé nativement.
//   - remonter dans la liste (scrollY > 0, glissement du doigt vers le
//     bas) : intact, touch-action repasse à "auto" dès qu'on quitte le
//     sommet.
// touch-action bascule dynamiquement selon la position de défilement —
// c'est ce qui permet de couvrir toute la zone sans rien casser.
//
// iOS (Safari et Chrome iOS, même moteur WebKit) : le geste avait été
// DÉSACTIVÉ le 13/09 — le rebond élastique natif du haut de page prenait la
// main avant nous. La tentative d'alors annulait le geste depuis les
// événements POINTEUR (`pointermove.preventDefault()`), qui, d'après la
// spécification, ne peuvent PAS empêcher un défilement : seul un
// `touchmove` non passif annulé peut le faire, et c'est ainsi que procèdent
// les bibliothèques de glisser-rafraîchir qui marchent sur iPhone. Réactivé
// le 26/09 à la demande de l'utilisateur, avec cette annulation tactile
// explicite — VALIDÉ sur iPhone par l'utilisateur le 26/09 (« tout
// marche »). `estIOS()` reste disponible si un modèle devait faire exception.
const SEUIL = 70; // px de tirage pour déclencher au lâcher

export function estIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ se déclare "MacIntel" mais garde un écran tactile
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export default function GlisserRafraichir({ onRafraichir, children }) {
  const [enCours, setEnCours] = useState(false);
  // « rien ne s'est passé » était le retour le plus fréquent : une liste à
  // l'identique après rafraîchissement ne PROUVE rien à l'œil — on confirme
  // donc explicitement, même quand aucune donnée n'a changé.
  const [confirme, setConfirme] = useState(false);
  const zoneRef = useRef(null);
  const iconeRef = useRef(null);
  const enCoursRef = useRef(false);
  // `onRafraichir` change de référence à CHAQUE rendu du parent quand ce
  // n'est pas une fonction mémoïsée (cas d'Offres.js) — si l'effet du geste
  // en dépendait, il se détachait/rattachait en plein milieu d'un geste
  // (perdant tient/décidé/tirage), donnant l'impression qu'il ne se passe
  // rien. La ref se met à jour sans jamais redéclencher l'effet.
  const onRafraichirRef = useRef(onRafraichir);
  useEffect(() => { onRafraichirRef.current = onRafraichir; });

  useEffect(() => {
    const zone = zoneRef.current;
    const icone = iconeRef.current;
    if (!zone) return;
    let y0 = 0, tient = false, decide = false, tirage = 0;

    // « pan-down » = le navigateur reste libre de faire défiler vers le bas
    // (glissement du doigt vers le HAUT) — jamais désactivé. « pan-up »
    // (glissement du doigt vers le bas) n'est PAS dans la liste : le
    // navigateur ne l'essaie même pas, c'est entièrement à nous dès qu'on
    // est en haut.
    const majTouchAction = () => {
      zone.style.touchAction = window.scrollY <= 0 ? "pan-down" : "auto";
    };
    majTouchAction();
    window.addEventListener("scroll", majTouchAction, { passive: true });

    const poser = (t) => {
      tirage = t;
      if (icone) {
        const ratio = Math.min(t / SEUIL, 1); // 0 → 1 pendant le tirage
        icone.style.opacity = t > 4 ? "1" : "0";
        icone.style.transform = `translateY(${Math.min(t, SEUIL) - 6}px) scale(${0.55 + 0.45 * ratio})`;
        icone.classList.toggle("pret", t >= SEUIL);
      }
    };

    const debut = (e) => {
      if (enCoursRef.current || window.scrollY > 0) return;
      y0 = e.clientY;
      tient = true;
      decide = false;
    };
    const bouge = (e) => {
      if (!tient) return;
      const dy = e.clientY - y0;
      if (!decide) {
        // vers le haut : ce n'est PAS nous (pan-down déjà natif de toute façon)
        if (dy < 0) { tient = false; return; }
        if (dy === 0) return; // encore immobile
        // Décidé dès le tout 1er pixel vers le bas (avant : seuil de 8px).
        // Sur iPhone, attendre 8px pour appeler preventDefault() arrivait
        // trop tard : le rebond élastique natif de Safari avait déjà pris
        // la main avant que notre JS ne réagisse — la flèche apparaissait
        // un instant puis repartait avec le rebond. Android tolère ce
        // délai (pas de rebond natif concurrent au sommet), pas iOS.
        decide = true;
        if (icone) icone.style.transition = "none"; // suit le doigt 1 pour 1, sans retard
      }
      // touch-action seul s'est révélé PAS fiable au toucher réel (bascule
      // posée en ligne par JS — le fil de composition ne la reprend pas
      // toujours à temps). On coupe donc aussi, explicitement, le geste
      // natif dès qu'on a décidé que c'est le nôtre : ceinture ET bretelles.
      if (e.cancelable) e.preventDefault();
      poser(Math.min(dy * 0.45, SEUIL * 1.5));
    };
    const fin = () => {
      if (!tient) return;
      tient = false;
      if (icone) icone.style.transition = ""; // revient à la transition CSS pour le retour en douceur
      if (decide && tirage >= SEUIL) {
        enCoursRef.current = true;
        setEnCours(true);
        Promise.resolve(onRafraichirRef.current?.()).finally(() => {
          enCoursRef.current = false;
          setEnCours(false);
          setConfirme(true);
          setTimeout(() => setConfirme(false), 1400);
          poser(0);
        });
      } else {
        poser(0);
      }
    };

    // iOS : c'est CET annulateur qui empêche le rebond élastique natif — un
    // touchmove non passif, annulé dès que le doigt tire vers le bas en haut
    // de page. Inoffensif ailleurs (touch-action fait déjà le travail).
    const toucheBouge = (e) => {
      if (!tient || !e.cancelable || window.scrollY > 0) return;
      const dy = (e.touches[0]?.clientY ?? y0) - y0;
      if (dy > 0) e.preventDefault();
    };

    zone.addEventListener("pointerdown", debut);
    document.addEventListener("pointermove", bouge, { passive: false });
    document.addEventListener("touchmove", toucheBouge, { passive: false });
    document.addEventListener("pointerup", fin);
    document.addEventListener("pointercancel", fin);
    return () => {
      window.removeEventListener("scroll", majTouchAction);
      zone.removeEventListener("pointerdown", debut);
      document.removeEventListener("pointermove", bouge);
      document.removeEventListener("touchmove", toucheBouge);
      document.removeEventListener("pointerup", fin);
      document.removeEventListener("pointercancel", fin);
    };
  }, []);

  return (
    <div ref={zoneRef} className="gr-zone">
      <div className="gr-zone-icone" aria-hidden="true">
        <span ref={iconeRef} className="gr-icone">
          {enCours
            ? <Loader2 size={18} className="gr-tourne" aria-hidden />
            : <ArrowDown size={18} aria-hidden />}
        </span>
      </div>
      {children}
      <div className={`toast${confirme ? " la" : ""}`} role="status">
        <Check size={14} aria-hidden style={{ verticalAlign: -2, marginRight: 5 }} /> Actualisé
      </div>
    </div>
  );
}
