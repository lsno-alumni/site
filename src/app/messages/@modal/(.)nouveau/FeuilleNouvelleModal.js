"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import FeuilleGlissante from "@/components/FeuilleGlissante";
import NouvelleConversation from "@/app/messages/nouveau/NouvelleConversation";

export default function FeuilleNouvelleModal() {
  const router = useRouter();
  return (
    <FeuilleGlissante depart="plein" sansFermer onFermer={() => router.back()} tete={<div className="cp-prise" />}>
      <Suspense fallback={null}><NouvelleConversation enFeuille /></Suspense>
    </FeuilleGlissante>
  );
}
