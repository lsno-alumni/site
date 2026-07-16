"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const APERCU_CAR = 200; // caractères visibles quand le récit est replié
const APERCU_LIGNES = 4; // ... et lignes max (des lignes courtes prennent peu
                         // de caractères mais beaucoup de hauteur)

// Récit replié par défaut pour ne pas noyer le profil sur mobile.
// La coupure est faite dans le texte (pas en CSS) : fiable partout.
export default function Histoire({ prenom, texte }) {
  const [ouverte, setOuverte] = useState(false);
  const lignes = texte.split("\n");
  const longue = texte.length > APERCU_CAR + 60 || lignes.length > APERCU_LIGNES + 1;

  let apercu = texte;
  if (longue && !ouverte) {
    apercu = lignes.slice(0, APERCU_LIGNES).join("\n");
    if (apercu.length > APERCU_CAR) {
      // coupe au dernier espace pour ne pas trancher un mot
      apercu = apercu.slice(0, APERCU_CAR);
      const espace = apercu.lastIndexOf(" ");
      if (espace > APERCU_CAR - 40) apercu = apercu.slice(0, espace);
    }
    apercu = apercu.trimEnd() + "…";
  }

  return (
    <section className="p-bloc p-histoire">
      <h4>Mon histoire</h4>
      <p className="recit">{apercu}</p>
      {longue && (
        <button className="offre-lire-plus" onClick={() => setOuverte(!ouverte)}>
          {ouverte
            ? <>Réduire <ChevronUp size={12} aria-hidden /></>
            : <>Lire l&apos;histoire de {prenom} <ChevronDown size={12} aria-hidden /></>}
        </button>
      )}
    </section>
  );
}
