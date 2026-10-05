"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { verifierVersion, saisieEnCours } from "@/lib/version";

// Veille de version, montée dans la mise en page racine (05/10). Deux filets
// contre l'« écart de version » : un onglet ou une appli restée ouverte pendant
// un déploiement continue de naviguer avec l'ancien code et demande des
// feuilles de style par écran qui n'existent plus en ligne → pages sans mise en
// page (vu le 05/10 après cinq déploiements dans la soirée).
//  1. à chaque changement d'écran, on compare la version : si une nouvelle est
//     en ligne, on recharge tout de suite (une navigation n'interrompt aucune
//     saisie) ;
//  2. si une feuille de style ne se charge pas, on recharge une fois, pas plus
//     d'une fois par minute (garde-fou contre les boucles).
const CLE = "lsno-recharge-css";
export default function VeilleVersion() {
  const chemin = usePathname();
  useEffect(() => {
    verifierVersion(true).then((n) => { if (n && !saisieEnCours()) window.location.reload(); });
  }, [chemin]);
  useEffect(() => {
    const surErreur = (e) => {
      const t = e.target;
      if (!t || t.tagName !== "LINK" || t.rel !== "stylesheet") return;
      let dernier = 0;
      try { dernier = Number(sessionStorage.getItem(CLE) || 0); } catch { /* rien */ }
      if (Date.now() - dernier < 60 * 1000) return;
      try { sessionStorage.setItem(CLE, String(Date.now())); } catch { /* rien */ }
      window.location.reload();
    };
    window.addEventListener("error", surErreur, true);   // capture : les erreurs de ressources ne remontent pas
    return () => window.removeEventListener("error", surErreur, true);
  }, []);
  return null;
}
