"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

// Partage d'une offre (feuille de partage du téléphone, sinon copie du lien)
export default function PartagerOffre({ o }) {
  const [copie, setCopie] = useState(false);
  const partager = async () => {
    const url = `${window.location.origin}/offres/${o.id}`;
    try {
      if (navigator.share) await navigator.share({ title: o.titre, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopie(true);
        setTimeout(() => setCopie(false), 2200);
      }
    } catch { /* partage annulé */ }
  };
  return (
    <button type="button" className="btn btn-nu" style={{ padding: "11px 16px", fontSize: 13.5 }} onClick={partager}>
      <Share2 size={13} aria-hidden /> {copie ? "Lien copié" : "Partager"}
    </button>
  );
}
