"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, ArrowDown, Check } from "lucide-react";

// Glisser vers le bas EN HAUT d'une liste pour la recharger (geste natif
// mobile attendu). Ne s'active que si la page est déjà tout en haut
// (window.scrollY === 0) ET que le geste est clairement vertical vers le
// bas — sinon on laisse le tap/scroll normal se produire sans y toucher
// (pas de setPointerCapture avant d'être sûr, sinon un simple tap sur une
// fiche serait perturbé).
const SEUIL = 70; // px de tirage pour déclencher au lâcher

export default function GlisserRafraichir({ onRafraichir, children }) {
  const [enCours, setEnCours] = useState(false);
  // « rien ne s'est passé » était le retour le plus fréquent : une liste à
  // l'identique après rafraîchissement ne PROUVE rien à l'œil — on confirme
  // donc explicitement, même quand aucune donnée n'a changé.
  const [confirme, setConfirme] = useState(false);
  const indicateurRef = useRef(null);
  const enCoursRef = useRef(false);
  // `onRafraichir` change de référence à CHAQUE rendu du parent quand ce
  // n'est pas une fonction mémoïsée (cas d'Offres.js) — si l'effet du geste
  // en dépendait, il se détachait/rattachait en plein milieu d'un geste
  // (perdant tient/décidé/tirage), donnant l'impression qu'il ne se passe
  // rien. La ref se met à jour sans jamais redéclencher l'effet.
  const onRafraichirRef = useRef(onRafraichir);
  useEffect(() => { onRafraichirRef.current = onRafraichir; });

  useEffect(() => {
    let y0 = 0, tient = false, decide = false, tirage = 0;
    const indic = indicateurRef.current;

    // hauteur de repos : la zone doit rester RÉELLEMENT tactile même sans
    // tirage (touch-action:none ne protège que l'élément qu'on touche
    // vraiment) — à hauteur 0 rien n'est là à toucher.
    const REPOS = 18;
    const poser = (t) => {
      tirage = t;
      if (indic) {
        indic.style.height = `${REPOS + t}px`;
        indic.style.opacity = t > 4 ? "1" : "0";
      }
    };

    const debut = (e) => {
      // tolérance de quelques px : sur certains téléphones, scrollY n'est
      // jamais EXACTEMENT 0 même visuellement tout en haut (sous-pixels)
      if (enCoursRef.current || window.scrollY > 3) return;
      y0 = e.clientY;
      tient = true;
      decide = false;
    };
    const bouge = (e) => {
      if (!tient) return;
      const dy = e.clientY - y0;
      if (!decide) {
        // sous 10px, rien n'est encore tranché : un tap normal doit rester
        // un tap normal, un scroll vers le haut doit rester un scroll
        if (Math.abs(dy) < 10) return;
        if (dy < 0 || window.scrollY > 3) { tient = false; return; }
        decide = true;
        if (indic) indic.style.transition = "none"; // suit le doigt 1 pour 1, sans retard
      }
      poser(Math.min(dy * 0.45, SEUIL * 1.5));
    };
    const fin = () => {
      if (!tient) return;
      tient = false;
      if (indic) indic.style.transition = ""; // revient à la transition CSS pour le retour en douceur
      if (decide && tirage >= SEUIL) {
        enCoursRef.current = true;
        setEnCours(true);
        if (indic) indic.style.height = "44px";
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

    // ⚠ pointerdown est posé sur LA ZONE (indic), pas document : c'est
    // `touch-action:none` en CSS STATIQUE sur cet élément précis qui dit au
    // navigateur, AVANT même que le doigt ne bouge, « ne gère pas toi-même
    // ce qui commence ici ». Un preventDefault() posé après coup (dans
    // bouge, sur un listener document) arrivait trop tard : le navigateur
    // avait déjà tranché en 1-2 pointermove que c'était SON geste — vérifié
    // par vidéo, la flèche grandissait à peine avant d'être coupée. Une
    // fois le geste engagé sur cette zone, pointermove/up/cancel restent
    // sur document pour continuer à suivre le doigt même hors de la zone.
    if (indic) indic.addEventListener("pointerdown", debut);
    document.addEventListener("pointermove", bouge);
    document.addEventListener("pointerup", fin);
    document.addEventListener("pointercancel", fin);
    return () => {
      if (indic) indic.removeEventListener("pointerdown", debut);
      document.removeEventListener("pointermove", bouge);
      document.removeEventListener("pointerup", fin);
      document.removeEventListener("pointercancel", fin);
    };
  }, []);

  return (
    <>
      <div ref={indicateurRef} className="gr-indicateur" aria-hidden="true">
        {enCours
          ? <Loader2 size={18} className="gr-tourne" aria-hidden />
          : <ArrowDown size={18} aria-hidden />}
      </div>
      {children}
      <div className={`toast${confirme ? " la" : ""}`} role="status">
        <Check size={14} aria-hidden style={{ verticalAlign: -2, marginRight: 5 }} /> Actualisé
      </div>
    </>
  );
}
