"use client";

import { useEffect, useRef, useState } from "react";

// Carrousel des photos du LSNO : défilement natif avec accroche (scroll-snap),
// avance automatique toutes les 4 s, se met en pause dès que l'utilisateur
// touche/survole, et reprend après. Points de navigation cliquables.
const PHOTOS = [
  { src: "/img/lsno_enseigne.jpg", alt: "Le Lycée Scientifique National de Ouagadougou" },
  { src: "/img/lsno_portail.jpg", alt: "Le portail du lycée" },
  { src: "/img/lsno_campus.jpg", alt: "Le campus vu du ciel" },
  { src: "/img/lsno_jardin.jpg", alt: "Le jardin « LSN » du lycée" },
  { src: "/img/lsno_promo1.jpg", alt: "Une promotion au grand complet" },
  { src: "/img/lsno_promo2.jpg", alt: "Une promotion réunie" },
  { src: "/img/lsno_groupe.jpg", alt: "Les élèves et leur encadrement" },
  { src: "/img/lsno_hero.jpg", alt: "Sur le chemin des cours" },
];

export default function Carrousel() {
  const piste = useRef(null);
  const [actif, setActif] = useState(0);
  const interaction = useRef(false);

  // avance automatique (suspendue pendant l'interaction et si onglet caché)
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      if (interaction.current || document.hidden || !piste.current) return;
      const p = piste.current;
      const suivant = (Math.round(p.scrollLeft / p.clientWidth) + 1) % PHOTOS.length;
      p.scrollTo({ left: suivant * p.clientWidth, behavior: "smooth" });
    }, 4000);
    return () => clearInterval(t);
  }, []);

  // suit la diapo visible pour allumer le bon point
  const auScroll = () => {
    const p = piste.current;
    setActif(Math.round(p.scrollLeft / p.clientWidth));
  };

  const pause = () => { interaction.current = true; };
  const reprise = () => { setTimeout(() => { interaction.current = false; }, 2500); };

  const allerA = (i) => {
    piste.current.scrollTo({ left: i * piste.current.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="carrousel">
      <div
        className="carrousel-piste"
        ref={piste}
        onScroll={auScroll}
        onPointerDown={pause}
        onPointerUp={reprise}
        onMouseEnter={pause}
        onMouseLeave={reprise}
      >
        {PHOTOS.map((ph, i) => (
          <figure className="carrousel-item" key={ph.src}>
            <img src={ph.src} alt={ph.alt} loading={i === 0 ? "eager" : "lazy"} draggable="false" />
          </figure>
        ))}
      </div>
      <div className="carrousel-points" role="tablist" aria-label="Photos du lycée">
        {PHOTOS.map((_, i) => (
          <button
            key={i}
            className={i === actif ? "on" : ""}
            aria-label={`Photo ${i + 1}`}
            aria-selected={i === actif}
            onClick={() => allerA(i)}
          />
        ))}
      </div>
    </div>
  );
}
