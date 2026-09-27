"use client";

import { useRouter } from "next/navigation";
import FeuilleGlissante from "@/components/FeuilleGlissante";
import FormulaireEvenement from "@/app/evenements/nouveau/FormulaireEvenement";

export default function FeuilleCreerModal({ moi, initial = null, modifier = false }) {
  const router = useRouter();
  return (
    <FeuilleGlissante depart="plein" sansFermer onFermer={() => router.back()} tete={<div className="cp-prise" />}>
      <FormulaireEvenement moi={moi} initial={initial} modifier={modifier} enFeuille />
    </FeuilleGlissante>
  );
}
