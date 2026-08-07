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
//   - remonter dans la liste (scrollY > 0, glissement vers le bas) : intact,
//     touch-action repasse à "auto" dès qu'on quitte le sommet.
//   - descendre dans la liste (glissement vers le HAUT, à tout moment) :
//     jamais touché, "pan-up" reste toujours autorisé nativement.
// touch-action bascule dynamiquement selon la position de défilement —
// c'est ce qui permet de couvrir toute la zone sans rien casser.
const SEUIL = 70; // px de tirage pour déclencher au lâcher

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

    // « pan-up » = le navigateur reste libre de faire défiler vers le bas
    // (glissement du doigt vers le HAUT) — jamais désactivé. « pan-down »
    // (glissement vers le bas) n'est PAS dans la liste : le navigateur ne
    // l'essaie même pas, c'est entièrement à nous dès qu'on est en haut.
    const majTouchAction = () => {
      zone.style.touchAction = window.scrollY <= 0 ? "pan-up" : "auto";
    };
    majTouchAction();
    window.addEventListener("scroll", majTouchAction, { passive: true });

    const poser = (t) => {
      tirage = t;
      if (icone) {
        icone.style.opacity = t > 4 ? "1" : "0";
        icone.style.transform = `translateY(${Math.min(t, SEUIL) - 6}px)`;
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
        // sous 10px, rien n'est encore tranché
        if (Math.abs(dy) < 10) return;
        // vers le haut : ce n'est PAS nous (pan-up déjà natif de toute façon)
        if (dy < 0) { tient = false; return; }
        decide = true;
        if (icone) icone.style.transition = "none"; // suit le doigt 1 pour 1, sans retard
      }
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

    zone.addEventListener("pointerdown", debut);
    document.addEventListener("pointermove", bouge);
    document.addEventListener("pointerup", fin);
    document.addEventListener("pointercancel", fin);
    return () => {
      window.removeEventListener("scroll", majTouchAction);
      zone.removeEventListener("pointerdown", debut);
      document.removeEventListener("pointermove", bouge);
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
