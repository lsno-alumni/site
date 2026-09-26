"use client";

import { useEffect } from "react";

// Ferme un menu ouvert dès qu'on touche ailleurs (ou Échap), sans obliger à
// réappuyer sur le bouton qui l'a ouvert. `estDedans(e)` dit si le tap vise
// CE menu (son bouton ou sa liste) : dedans, il agit ; dehors, il ferme —
// y compris quand « dehors » est le bouton ⋯ d'une autre carte.
export default function useClicDehors(actif, estDedans, fermer) {
  useEffect(() => {
    if (!actif) return;
    const dehors = (e) => { if (!estDedans(e)) fermer(); };
    const touche = (e) => { if (e.key === "Escape") fermer(); };
    // pointerdown : avant le clic, pour que le geste qui ferme ne déclenche
    // rien d'autre par surprise ; en capture pour passer avant stopPropagation
    document.addEventListener("pointerdown", dehors, true);
    document.addEventListener("keydown", touche);
    return () => {
      document.removeEventListener("pointerdown", dehors, true);
      document.removeEventListener("keydown", touche);
    };
  }, [actif, estDedans, fermer]);
}
