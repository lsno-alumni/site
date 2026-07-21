"use client";

import { useRouter } from "next/navigation";

// Retour vers la page précédente si on vient d'une page interne
// (annuaire, accueil…), sinon vers `secours`. `libelle` = texte affiché.
export default function RetourDynamique({ secours = "/", libelle = "Retour", className = "retour" }) {
  const routeur = useRouter();
  const retour = () => {
    if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) {
      routeur.back();
    } else {
      routeur.push(secours);
    }
  };
  return (
    <button className={className} onClick={retour}
      style={{ background: "none", border: "none", cursor: "pointer", font: "inherit", color: "inherit" }}>
      ← {libelle}
    </button>
  );
}
