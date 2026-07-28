"use client";

import { useRouter } from "next/navigation";
import { peutRevenir } from "@/components/SuiviNavigation";

// Retour vers la page précédente si on vient d'une page interne
// (annuaire, accueil…), sinon vers `secours`. `libelle` = texte affiché.
// ⚠ On NE se fie PAS à document.referrer : la navigation Next est côté client,
// il ne change jamais et il est vide quand on ouvre le site par l'icône PWA —
// le retour partait alors toujours vers `secours` (ex. Annuaire → Conseils →
// Retour atterrissait sur l'accueil). peutRevenir() compte les navigations
// internes réelles (voir SuiviNavigation.js).
export default function RetourDynamique({ secours = "/", libelle = "Retour", className = "retour" }) {
  const routeur = useRouter();
  const retour = () => {
    if (peutRevenir()) routeur.back();
    else routeur.push(secours);
  };
  return (
    <button className={className} onClick={retour}
      style={{ background: "none", border: "none", cursor: "pointer", font: "inherit", color: "inherit" }}>
      ← {libelle}
    </button>
  );
}
