"use client";

import { useState } from "react";
import Visionneuse from "@/components/Visionneuse";

// Plusieurs photos disposées façon Facebook : 1 en grand, 2 côte à côte,
// 3 = une grande + deux petites, 4 = grille, 5 et plus = grille avec « +N »
// sur la dernière. Un tap ouvre la visionneuse (défilement d'une photo à
// l'autre), sans déclencher le lien de la carte autour.
export default function Collage({ urls, alt = "", className = "" }) {
  const [ouverte, setOuverte] = useState(null);   // index de la photo ouverte
  if (!urls?.length) return null;
  const n = urls.length;
  const visibles = urls.slice(0, 4);
  const reste = n - 4;
  const ouvrir = (e, i) => { e.preventDefault(); e.stopPropagation(); setOuverte(i); };
  return (
    <>
      <div className={`collage collage-${Math.min(n, 4)}${className ? " " + className : ""}`} onPointerDown={(e) => e.stopPropagation()}>
        {visibles.map((u, i) => (
          <button key={i} type="button" className="collage-case" onClick={(e) => ouvrir(e, i)} aria-label={`Photo ${i + 1} sur ${n}`}>
            <img src={u} alt={alt} loading="lazy" draggable={false} />
            {i === 3 && reste > 0 && <span className="collage-plus">+{reste}</span>}
          </button>
        ))}
      </div>
      {ouverte !== null && <Visionneuse urls={urls} depart={ouverte} onFermer={() => setOuverte(null)} />}
    </>
  );
}
