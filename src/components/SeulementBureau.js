"use client";

import { useEffect, useState } from "react";

// Chantier bureau : ne rend ses enfants qu'en grand écran (≥ 1024 px), et seulement
// après le montage — rien côté serveur, rien sur téléphone. À réserver aux blocs qui
// ont un coût (requêtes, abonnements temps réel) : les blocs purement visuels se
// cachent plus simplement avec une classe « bu ».
export default function SeulementBureau({ children }) {
  const [grand, setGrand] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const maj = () => setGrand(media.matches);
    maj();
    media.addEventListener("change", maj);
    return () => media.removeEventListener("change", maj);
  }, []);
  return grand ? children : null;
}
