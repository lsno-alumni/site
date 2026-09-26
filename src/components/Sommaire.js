"use client";

import { useEffect, useState } from "react";

// Sommaire collant d'une longue page : une rangée de pastilles (mêmes puces
// que les filtres) qui reste collée en haut ; la pastille de la section en
// cours de lecture s'allume et se recentre. `sections` = [{ id, nom }], les
// ids étant ceux des titres de section dans la page.
export default function Sommaire({ sections, aria = "Sommaire", className = "" }) {
  const [enVue, setEnVue] = useState(null);

  // la section en cours = le dernier titre passé au-dessus de la ligne de
  // lecture (130 px sous le haut de l'écran) ; un observateur d'intersection
  // ne suffit pas, les titres sont petits et sortent vite de l'écran
  useEffect(() => {
    let planifie = false;
    const evaluer = () => {
      planifie = false;
      let courant = null;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= 130) courant = s.id;
      }
      setEnVue(courant);
    };
    const auDefilement = () => { if (!planifie) { planifie = true; requestAnimationFrame(evaluer); } };
    window.addEventListener("scroll", auDefilement, { passive: true });
    auDefilement();
    return () => window.removeEventListener("scroll", auDefilement);
  }, [sections]);

  useEffect(() => {
    document.querySelector(`.sommaire-${aria.length} .puce.en-vue`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [enVue, aria]);

  const aller = (e, id) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav className={`n-panneau sommaire-${aria.length} ${className}`} aria-label={aria}>
      <div className="n-filtres">
        {sections.map(({ id, nom }) => (
          <a key={id} href={`#${id}`} className={`puce${enVue === id ? " en-vue" : ""}`} onClick={(e) => aller(e, id)}>{nom}</a>
        ))}
      </div>
    </nav>
  );
}
