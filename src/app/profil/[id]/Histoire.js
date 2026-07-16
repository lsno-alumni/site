"use client";

import { useState } from "react";

// Récit replié par défaut pour ne pas noyer le profil sur mobile.
export default function Histoire({ prenom, texte }) {
  const [ouverte, setOuverte] = useState(false);
  const longue = texte.length > 220;

  return (
    <section className="p-bloc p-histoire">
      <h4>Mon histoire</h4>
      <p className={`recit${ouverte || !longue ? " ouvert" : ""}`}>{texte}</p>
      {longue && (
        <button className="offre-lire-plus" onClick={() => setOuverte(!ouverte)}>
          {ouverte ? "Réduire" : `Lire l'histoire de ${prenom}`}
        </button>
      )}
    </section>
  );
}
