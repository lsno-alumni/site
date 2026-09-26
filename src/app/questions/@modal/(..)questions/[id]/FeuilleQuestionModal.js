"use client";

import { useRouter } from "next/navigation";
import FeuilleGlissante from "@/components/FeuilleGlissante";
import { TeteQuestion, SuiteQuestion } from "@/app/questions/[id]/ContenuQuestion";

// Fermer la feuille = revenir à la liste telle qu'elle était.
export default function FeuilleQuestionModal({ q, moi, moderateur }) {
  const router = useRouter();
  return (
    <FeuilleGlissante onFermer={() => router.back()} tete={<div className="pu-feuille-tete"><TeteQuestion q={q} /></div>}>
      <SuiteQuestion q={q} moi={moi} moderateur={moderateur} enFeuille />
    </FeuilleGlissante>
  );
}
