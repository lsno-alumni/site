"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const APERCU = 200; // caractères visibles quand le récit est replié

// Récit replié par défaut pour ne pas noyer le profil sur mobile.
// La coupure est faite dans le texte (pas en CSS) : fiable partout.
export default function Histoire({ prenom, texte }) {
  const [ouverte, setOuverte] = useState(false);
  const longue = texte.length > APERCU + 60; // pas de bouton pour 2 lignes de plus

  // coupe au dernier espace pour ne pas trancher un mot
  let apercu = texte;
  if (longue && !ouverte) {
    apercu = texte.slice(0, APERCU);
    const espace = apercu.lastIndexOf(" ");
    if (espace > APERCU - 40) apercu = apercu.slice(0, espace);
    apercu += "…";
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
