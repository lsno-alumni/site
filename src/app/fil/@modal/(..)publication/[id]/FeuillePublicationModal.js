"use client";

import { useRouter } from "next/navigation";
import FeuilleGlissante from "@/components/FeuilleGlissante";
import { TetePublication, SuitePublication } from "@/app/publication/[id]/ContenuPublication";

// Fermer la feuille = revenir au Fil tel qu'il était (position comprise).
// TÊTE = auteur + texte (glissable, purement visuel) ; SUITE = photo,
// actions, commentaires, saisie (jamais glissable).
export default function FeuillePublicationModal({ p, commentaires, moi, moderateur }) {
  const router = useRouter();
  return (
    <FeuilleGlissante onFermer={() => router.back()} tete={<div className="pu-feuille-tete"><TetePublication p={p} /></div>}>
      <SuitePublication p={p} commentaires={commentaires} moi={moi} moderateur={moderateur} enFeuille />
    </FeuilleGlissante>
  );
}
