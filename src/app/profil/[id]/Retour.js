"use client";

import { useRouter } from "next/navigation";

// Retour vers la page d'où l'on vient (annuaire AVEC ses filtres et sa
// position, offres, accueil…) ; annuaire en secours si arrivée directe.
export default function Retour() {
  const routeur = useRouter();
  const retour = () => {
    if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) {
      routeur.back();
    } else {
      routeur.push("/annuaire");
    }
  };
  return (
    <button className="p-retour" onClick={retour} aria-label="Retour"
      style={{ border: "1px solid rgba(245,241,232,.18)", color: "var(--craie)", cursor: "pointer" }}>
      ←
    </button>
  );
}
