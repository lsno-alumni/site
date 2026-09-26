"use client";

import { useEffect, useState } from "react";
import { creerClientNavigateur } from "@/lib/supabase/client";

// Une ligne de preuve sous les formulaires d'entrée : les chiffres publics
// du réseau (même fonction que l'accueil, lisible sans session). Rien tant
// que les chiffres ne sont pas là : pas de « 0 anciens » qui clignote.
export default function PreuveReseau({ avant = "" }) {
  const [s, setS] = useState(null);
  useEffect(() => {
    let vivant = true;
    creerClientNavigateur().rpc("stats_publiques").then(({ data }) => {
      if (vivant && data?.anciens) setS(data);
    });
    return () => { vivant = false; };
  }, []);
  return (
    <p className="f-preuve" aria-live="polite">
      {s && (
        <>
          {avant}<b>{s.anciens}</b> anciens · <b>{s.pays}</b> pays · <b>{s.promotions}</b> promotions
        </>
      )}
    </p>
  );
}
