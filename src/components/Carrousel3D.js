"use client";

import { useEffect, useRef, useState } from "react";

// Carrousel « coverflow » 3D : la photo active à plat au centre, les voisines
// inclinées en perspective et reculées. CSS 3D pur (léger). Auto-défilement,
// pause à l'interaction, glisser au doigt, points cliquables.
const PHOTOS = [
  { src: "/img/lsno_enseigne.jpg", alt: "Le Lycée Scientifique National de Ouagadougou" },
  { src: "/img/lsno_portail.jpg", alt: "Le portail du lycée" },
  { src: "/img/lsno_campus.jpg", alt: "Le campus vu du ciel" },
  { src: "/img/lsno_jardin.jpg", alt: "Le jardin « LSN » du lycée" },
  { src: "/img/lsno_promo1.jpg", alt: "Une promotion au grand complet" },
  { src: "/img/lsno_promo2.jpg", alt: "Une promotion réunie" },
  { src: "/img/lsno_promo3.jpg", alt: "Une promotion sous le manguier" },
  { src: "/img/lsno_groupe.jpg", alt: "Les élèves et leur encadrement" },
  { src: "/img/lsno_hero.jpg", alt: "Sur le chemin des cours" },
];

export default function Carrousel3D() {
  const [actif, setActif] = useState(0);
  const interaction = useRef(false);
  const drag = useRef(null);
  const n = PHOTOS.length;

  const aller = (i) => setActif(((i % n) + n) % n);
  const pause = () => { interaction.current = true; };
  const reprise = () => { setTimeout(() => { interaction.current = false; }, 3000); };

  // auto-défilement
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      if (interaction.current || document.hidden) return;
      setActif((a) => (a + 1) % n);
    }, 4000);
    return () => clearInterval(t);
  }, [n]);

  // glisser (souris + tactile)
  const onDown = (e) => { pause(); drag.current = e.clientX; };
  const onUp = (e) => {
    if (drag.current === null) return;
    const dx = e.clientX - drag.current;
    drag.current = null;
    if (dx > 40) aller(actif - 1);
    else if (dx < -40) aller(actif + 1);
    reprise();
  };

  // position 3D de chaque carte selon son décalage à l'active
  const style = (i) => {
    let o = i - actif;
    if (o > n / 2) o -= n;
    if (o < -n / 2) o += n;
    const abs = Math.abs(o);
    if (abs > 2) return { opacity: 0, pointerEvents: "none", transform: "translateX(0) scale(.4)" };
    return {
      transform:
        `translateX(${o * 52}%) translateZ(${-abs * 130}px) rotateY(${o * -32}deg) scale(${o === 0 ? 1 : 0.9})`,
      opacity: o === 0 ? 1 : 0.5,
      zIndex: 10 - abs,
      pointerEvents: o === 0 ? "auto" : "none",
    };
  };

  return (
    <div className="cv3d" onMouseEnter={pause} onMouseLeave={reprise}>
      <div
        className="cv3d-scene"
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerLeave={(e) => drag.current !== null && onUp(e)}
      >
        {PHOTOS.map((ph, i) => {
          const o = ((i - actif + n) % n);
          const dist = Math.min(o, n - o);
          return (
            <figure
              key={ph.src}
              className={`cv3d-carte${i === actif ? " actif" : ""}`}
              style={style(i)}
              onClick={() => i !== actif && aller(i)}
              aria-hidden={i !== actif}
            >
              <img src={ph.src} alt={ph.alt} draggable="false" loading={dist <= 1 ? "eager" : "lazy"} />
            </figure>
          );
        })}
      </div>
      <div className="cv3d-points" role="tablist" aria-label="Photos du lycée">
        {PHOTOS.map((_, i) => (
          <button
            key={i}
            className={i === actif ? "on" : ""}
            aria-label={`Photo ${i + 1}`}
            aria-selected={i === actif}
            onClick={() => { pause(); aller(i); reprise(); }}
          />
        ))}
      </div>
    </div>
  );
}
