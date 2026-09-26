"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Clock } from "lucide-react";
import { enregistrer, lireReglage } from "@/lib/theme";

const OPTIONS = [
  { cle: "clair", nom: "Clair", Icone: Sun },
  { cle: "sombre", nom: "Sombre", Icone: Moon },
  { cle: "auto", nom: "Auto", Icone: Clock },
];

// Sélecteur à trois positions (menu public et Mon profil). « Auto » suit
// l'heure de l'appareil : clair le jour, sombre la nuit.
export default function ChoixTheme({ compact = false }) {
  // rendu serveur sans choix marqué, puis lecture du réglage côté client
  const [reglage, setReglage] = useState(null);
  useEffect(() => { setReglage(lireReglage()); }, []); // eslint-disable-line react-hooks/set-state-in-effect

  const choisir = (cle) => { enregistrer(cle); setReglage(cle); };

  return (
    <div className={`choix-theme${compact ? " compact" : ""}`} role="group" aria-label="Apparence">
      {OPTIONS.map(({ cle, nom, Icone }) => (
        <button key={cle} type="button" className={reglage === cle ? "on" : ""}
          aria-pressed={reglage === cle} onClick={() => choisir(cle)}>
          <Icone size={14} strokeWidth={1.9} aria-hidden /> {nom}
        </button>
      ))}
    </div>
  );
}
