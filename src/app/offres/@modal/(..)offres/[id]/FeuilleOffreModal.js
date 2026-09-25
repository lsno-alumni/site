"use client";

import { useRouter } from "next/navigation";
import FeuilleGlissante from "@/components/FeuilleGlissante";
import { CouvertureOffre, TeteOffre, SuiteOffre } from "@/app/offres/[id]/ContenuOffre";

// Fermer la feuille = revenir en arrière : Next quitte la route interceptée
// et retrouve la liste telle qu'elle était (filtres et position compris).
// TÊTE (couverture + titre, purement visuelle) = zone glissable ;
// SUITE (description, boutons, auteur) = zone défilante, jamais glissable.
export default function FeuilleOffreModal({ o, moiId, jours }) {
  const router = useRouter();
  return (
    <FeuilleGlissante
      onFermer={() => router.back()}
      tete={<>
        <CouvertureOffre o={o} jours={jours} />
        <TeteOffre o={o} />
      </>}
    >
      <SuiteOffre o={o} moiId={moiId} />
    </FeuilleGlissante>
  );
}
