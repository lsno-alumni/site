"use client";

import { useRouter } from "next/navigation";
import { peutRevenir } from "@/components/SuiviNavigation";

// Retour vers la page d'où l'on vient (annuaire AVEC ses filtres et sa
// position, offres, accueil…) ; annuaire en secours si arrivée directe.
// (détection fiable : voir SuiviNavigation.js — document.referrer ne marche pas
// avec la navigation côté client de Next)
export default function Retour() {
  const routeur = useRouter();
  const retour = () => {
    if (peutRevenir()) routeur.back();
    else routeur.push("/annuaire");
  };
  return (
    <button className="p-retour" onClick={retour} aria-label="Retour"
      style={{ border: "1px solid rgba(245,241,232,.18)", color: "var(--craie)", cursor: "pointer" }}>
      ←
    </button>
  );
}
