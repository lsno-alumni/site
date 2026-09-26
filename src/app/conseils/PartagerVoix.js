"use client";

import { useState } from "react";
import { Share2, Loader2 } from "lucide-react";

// Partager une voix : l'image carrée (/conseils/carte/[id]) est envoyée
// telle quelle à WhatsApp par la feuille de partage du téléphone ; sans
// partage de fichiers (ordinateur), elle est téléchargée.
export default function PartagerVoix({ id, prenom }) {
  const [etat, setEtat] = useState("");   // "" | "prep" | "ok" | "ko"
  const partager = async () => {
    if (etat === "prep") return;
    setEtat("prep");
    try {
      const rep = await fetch(`/conseils/carte/${id}`);
      if (!rep.ok) throw new Error(String(rep.status));
      const fichier = new File([await rep.blob()], `conseil-${prenom.toLowerCase()}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [fichier] })) {
        await navigator.share({ files: [fichier], title: `Un conseil de ${prenom} — LSNO Amicale` });
      } else {
        const url = URL.createObjectURL(fichier);
        const a = Object.assign(document.createElement("a"), { href: url, download: fichier.name });
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
      setEtat("ok");
    } catch (e) {
      setEtat(e?.name === "AbortError" ? "" : "ko");
    }
    setTimeout(() => setEtat(""), 2200);
  };
  return (
    <button type="button" className="voix-partage" onClick={partager} aria-label={`Partager le conseil de ${prenom}`}>
      {etat === "prep" ? <Loader2 size={15} aria-hidden className="tourne" /> : <Share2 size={15} aria-hidden />}
      {etat === "ok" && <span>Envoyé</span>}
      {etat === "ko" && <span>Réessaie</span>}
    </button>
  );
}
