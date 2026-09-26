"use client";

import { useRouter } from "next/navigation";
import FeuilleGlissante from "@/components/FeuilleGlissante";
import Composer from "@/app/fil/nouvelle/Composer";

export default function FeuilleComposerModal({ moi }) {
  const router = useRouter();
  return (
    <FeuilleGlissante depart="plein" sansFermer onFermer={() => router.back()} tete={<div className="cp-prise" />}>
      <Composer moi={moi} enFeuille />
    </FeuilleGlissante>
  );
}
