"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Grand écran (chantier bureau) : deux flèches de part et d'autre d'une rangée qui
// défile à l'horizontale (nouveaux membres du fil, voisins d'un profil…). Le premier
// enfant est la rangée elle-même ; les flèches la font avancer d'un écran et
// disparaissent au bout. Sur mobile, l'enveloppe est transparente (display: contents,
// bureau.css) et les flèches sont cachées : la rangée se glisse au doigt, comme avant.
export default function Defilable({ children, className = "" }) {
  const ref = useRef(null);
  const [peut, setPeut] = useState({ gauche: false, droite: false });

  useEffect(() => {
    const rail = ref.current?.firstElementChild;
    if (!rail) return;
    const mesurer = () => {
      const max = rail.scrollWidth - rail.clientWidth;
      setPeut({ gauche: rail.scrollLeft > 2, droite: rail.scrollLeft < max - 2 });
    };
    mesurer();
    rail.addEventListener("scroll", mesurer, { passive: true });
    const obs = typeof ResizeObserver !== "undefined" ? new ResizeObserver(mesurer) : null;
    obs?.observe(rail);
    return () => { rail.removeEventListener("scroll", mesurer); obs?.disconnect(); };
  }, []);

  const avancer = (sens) => {
    const rail = ref.current?.firstElementChild;
    rail?.scrollBy({ left: sens * rail.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <div ref={ref} className={`bu-defil${className ? " " + className : ""}`}>
      {children}
      <button type="button" className="bu bu-fleche gauche" aria-label="Précédents" disabled={!peut.gauche} onClick={() => avancer(-1)}><ChevronLeft size={20} aria-hidden /></button>
      <button type="button" className="bu bu-fleche droite" aria-label="Suivants" disabled={!peut.droite} onClick={() => avancer(1)}><ChevronRight size={20} aria-hidden /></button>
    </div>
  );
}
