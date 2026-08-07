"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

// Feuille qui glisse par-dessus la page (façon LinkedIn) : ouverte à mi-écran
// (aperçu), on tire la « prise » (tête, purement visuelle) vers le haut pour
// l'agrandir en plein écran, vers le bas pour la refermer. Le contenu ne
// change pas entre les deux états — seule la hauteur visible varie, comme
// sur un vrai bottom sheet. Bloque le défilement de la page pendant qu'elle
// est ouverte (même principe que Visionneuse.js) : la liste derrière reste
// IMMOBILE pendant le geste, pour ne pas reproduire le bug GPU de la tabbar
// (couche translucide qui bouge PENDANT qu'une liste défile).
//
// ⚠ La zone de prise (tete) doit rester PUREMENT VISUELLE (photo, nom,
// badges…) — jamais de bouton ni de champ dedans : le geste capture le
// pointeur sur toute cette zone, un clic sur un bouton qui s'y trouverait
// serait avalé par le glissement. Les boutons/formulaires vont dans
// `children` (défilant), jamais dans `tete`.
const PEEK = 0.55; // fraction de l'écran occupée à l'ouverture

export default function FeuilleGlissante({ tete, children, onFermer }) {
  const [etat, setEtat] = useState("peek"); // peek | plein | ferme
  const feuilleRef = useRef(null);
  const priseRef = useRef(null);
  const hauteurRef = useRef(typeof window !== "undefined" ? window.innerHeight : 800);

  const positionPour = (e) => {
    const h = hauteurRef.current;
    if (e === "ferme") return h;
    if (e === "peek") return h * PEEK;
    return 0;
  };

  const aller = (e, animee = true) => {
    setEtat(e);
    const f = feuilleRef.current;
    if (!f) return;
    f.style.transition = animee ? "" : "none";
    f.style.transform = `translateY(${positionPour(e)}px)`;
    if (e === "ferme") setTimeout(onFermer, animee ? 280 : 0);
  };

  // Anime l'ENTRÉE au montage sans passer par setEtat : l'état initial
  // ("peek") est déjà correct, seule la position VISUELLE (fermée → mi-écran)
  // doit s'animer — un pur ajustement du DOM, pas une synchronisation d'état.
  useEffect(() => {
    hauteurRef.current = window.innerHeight;
    document.body.style.overflow = "hidden";
    const f = feuilleRef.current;
    if (f) {
      f.style.transition = "none";
      f.style.transform = `translateY(${hauteurRef.current}px)`;
      requestAnimationFrame(() => {
        f.style.transition = "";
        f.style.transform = `translateY(${hauteurRef.current * PEEK}px)`;
      });
    }
    const esc = (e) => e.key === "Escape" && aller("ferme");
    document.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", esc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const prise = priseRef.current;
    const f = feuilleRef.current;
    if (!prise || !f) return;
    let y0 = 0, depart = 0, dernierY = 0, dernierT = 0, vitesse = 0, tient = false;

    const descendre = (e) => {
      tient = true;
      y0 = e.clientY;
      dernierY = e.clientY;
      dernierT = performance.now();
      vitesse = 0;
      depart = positionPour(etat);
      f.style.transition = "none";
      prise.setPointerCapture(e.pointerId);
    };
    const bouger = (e) => {
      if (!tient) return;
      const maintenant = performance.now();
      const dt = maintenant - dernierT;
      if (dt > 0) vitesse = (e.clientY - dernierY) / dt; // px/ms
      dernierY = e.clientY;
      dernierT = maintenant;
      const dy = e.clientY - y0;
      const h = hauteurRef.current;
      f.style.transform = `translateY(${Math.max(0, Math.min(h, depart + dy))}px)`;
    };
    const lacher = (e) => {
      if (!tient) return;
      tient = false;
      f.style.transition = "";
      const h = hauteurRef.current;
      const actuel = depart + (e.clientY - y0);
      // un geste rapide (élan) l'emporte sur la seule position au lâcher
      if (vitesse > 0.5) { aller("ferme"); return; }
      if (vitesse < -0.5) { aller("plein"); return; }
      if (actuel > h * 0.75) aller("ferme");
      else if (actuel < h * PEEK * 0.5) aller("plein");
      else aller(actuel < h * PEEK ? "plein" : "peek");
    };
    prise.addEventListener("pointerdown", descendre);
    prise.addEventListener("pointermove", bouger);
    prise.addEventListener("pointerup", lacher);
    prise.addEventListener("pointercancel", lacher);
    return () => {
      prise.removeEventListener("pointerdown", descendre);
      prise.removeEventListener("pointermove", bouger);
      prise.removeEventListener("pointerup", lacher);
      prise.removeEventListener("pointercancel", lacher);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etat]);

  return (
    <div className="fg-scrim" onClick={() => aller("ferme")} role="presentation">
      <div
        ref={feuilleRef}
        className="fg-feuille"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div ref={priseRef} className="fg-prise">
          <div className="fg-poignee"><i /></div>
          {tete}
        </div>
        <button type="button" className="fg-fermer" aria-label="Fermer" onClick={() => aller("ferme")}>
          <X size={20} aria-hidden />
        </button>
        <div className="fg-contenu" style={{ overflowY: etat === "plein" ? "auto" : "hidden" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
