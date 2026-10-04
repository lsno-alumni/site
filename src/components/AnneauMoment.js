"use client";

import { useRouter } from "next/navigation";
import { useAuteursMoments } from "@/lib/moments";

// Entoure la photo d'un membre d'un anneau quand il a un moment en cours
// (bleu = pas encore vu, gris = déjà vu). Un tap sur l'anneau ouvre ce
// moment dans le Fil, sans suivre le lien autour (fiche de l'annuaire).
export default function AnneauMoment({ membreId, children, className = "" }) {
  const routeur = useRouter();
  const carte = useAuteursMoments();
  const info = carte.get(membreId);
  if (!info) return children;
  const ouvrir = (e) => { e.preventDefault(); e.stopPropagation(); routeur.push(`/fil?moment=${info.id}`); };
  return (
    <span className={`anneau-moment${info.nouveau ? " nouveau" : " vu"} ${className}`} role="button" tabIndex={0}
      title={info.nouveau ? "Un moment à voir" : "Moment en cours"} aria-label={info.nouveau ? "Un moment à voir" : "Moment en cours"}
      onClick={ouvrir} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") ouvrir(e); }}>
      {children}
    </span>
  );
}
