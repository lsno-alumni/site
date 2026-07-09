"use client";

import { useEffect, useState } from "react";

// Poussière d'or du héros — 10 particules, transforms GPU uniquement.
// (Générée au montage côté client : pas de Math.random au rendu serveur.)
export default function Poussiere() {
  const [grains, setGrains] = useState([]);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setGrains(Array.from({ length: 10 }, (_, i) => ({
      id: i,
      gauche: Math.random() * 100,
      taille: 2 + Math.random() * 3,
      duree: 9 + Math.random() * 10,
      retard: -Math.random() * 14,
    })));
  }, []);
  return grains.map((g) => (
    <i key={g.id} className="pouss" style={{
      left: `${g.gauche}%`, width: g.taille, height: g.taille,
      animationDuration: `${g.duree}s`, animationDelay: `${g.retard}s`,
    }} />
  ));
}
