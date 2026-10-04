"use client";

import { useEffect, useState } from "react";
import TourNouveautes from "@/components/TourNouveautes";
import { TOUR_VERSION, cartesPour, useTourEtat } from "@/lib/tour";

// À l'ouverture de l'appli (accueil connecté) : si le compte n'a pas encore
// vu cette version du tour, il s'ouvre, une fois. Lecture côté client : tant
// que la migration 72 n'est pas passée, rien ne s'affiche et rien ne casse.
export default function LanceurTour() {
  const etat = useTourEtat();
  const [ouvert, setOuvert] = useState(false);
  const [refuse, setRefuse] = useState(false);
  useEffect(() => {
    if (refuse || !etat) return;
    const t = setTimeout(() => { if ((etat.tour_version ?? 0) < TOUR_VERSION) setOuvert(true); }, 900);   // la page se pose d'abord
    return () => clearTimeout(t);
  }, [etat, refuse]);
  if (!ouvert) return null;
  return <TourNouveautes cartes={cartesPour(etat?.role)} onFermer={() => { setOuvert(false); setRefuse(true); }} />;
}
