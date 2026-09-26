"use client";

import { useRouter } from "next/navigation";
import FeuilleGlissante from "@/components/FeuilleGlissante";
import PoserQuestion from "@/app/questions/nouvelle/PoserQuestion";

export default function FeuillePoserModal({ moi }) {
  const router = useRouter();
  return (
    <FeuilleGlissante depart="plein" sansFermer onFermer={() => router.back()} tete={<div className="cp-prise" />}>
      <PoserQuestion moi={moi} enFeuille />
    </FeuilleGlissante>
  );
}
