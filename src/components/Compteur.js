"use client";

import { useEffect, useRef, useState } from "react";

// Compte de 0 à `valeur` quand l'élément devient visible.
export default function Compteur({ valeur }) {
  const ref = useRef(null);
  const [affiche, setAffiche] = useState(0);

  useEffect(() => {
    const cible = Number(valeur) || 0;
    const io = new IntersectionObserver((entrees) => {
      if (!entrees[0].isIntersecting) return;
      io.disconnect();
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setAffiche(cible);
        return;
      }
      const t0 = performance.now();
      const pas = (t) => {
        const p = Math.min((t - t0) / 1100, 1);
        setAffiche(Math.round(cible * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(pas);
      };
      requestAnimationFrame(pas);
    }, { threshold: 0.6 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [valeur]);

  return <span ref={ref}>{affiche}</span>;
}
