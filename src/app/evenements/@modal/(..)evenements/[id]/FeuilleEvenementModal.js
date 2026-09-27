"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FeuilleGlissante from "@/components/FeuilleGlissante";
import { TeteEvenement, SuiteEvenement } from "@/app/evenements/[id]/ContenuEvenement";

// Fermer la feuille = revenir à la liste (ou au Fil) tel qu'il était.
export default function FeuilleEvenementModal({ e: initial, moi, moderateur }) {
  const router = useRouter();
  const [e, setE] = useState(initial);
  return (
    <FeuilleGlissante onFermer={() => router.back()} tete={<div className="pu-feuille-tete"><TeteEvenement e={e} /></div>}>
      <SuiteEvenement e={e} moi={moi} moderateur={moderateur} enFeuille onMaj={setE} />
    </FeuilleGlissante>
  );
}
