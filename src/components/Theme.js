"use client";

import { useEffect } from "react";
import { appliquer, lireReglage, resoudre } from "@/lib/theme";

// Monté une fois dans le layout : en réglage « auto », le thème bascule tout
// seul quand l'heure passe 6 h ou 19 h pendant que l'appli reste ouverte.
export default function Theme() {
  useEffect(() => {
    const verifier = () => appliquer(resoudre(lireReglage()));
    verifier();
    const minuteur = setInterval(verifier, 60_000);
    window.addEventListener("lsno-theme", verifier);
    document.addEventListener("visibilitychange", verifier);
    return () => {
      clearInterval(minuteur);
      window.removeEventListener("lsno-theme", verifier);
      document.removeEventListener("visibilitychange", verifier);
    };
  }, []);
  return null;
}
