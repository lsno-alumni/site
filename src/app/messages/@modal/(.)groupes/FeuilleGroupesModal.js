"use client";

import { useRouter } from "next/navigation";
import FeuilleGlissante from "@/components/FeuilleGlissante";
import Groupes from "@/app/messages/groupes/Groupes";

export default function FeuilleGroupesModal() {
  const router = useRouter();
  return (
    <FeuilleGlissante depart="plein" sansFermer onFermer={() => router.back()} tete={<div className="cp-prise" />}>
      <Groupes enFeuille />
    </FeuilleGlissante>
  );
}
