"use client";

import { useRouter } from "next/navigation";
import FeuilleGlissante from "@/components/FeuilleGlissante";
import ContenuProfil from "@/app/profil/[id]/ContenuProfil";

// Fermer la feuille = revenir en arrière : Next quitte alors la route
// interceptée et retrouve l'annuaire tel qu'il était (scroll compris),
// sans jamais l'avoir vraiment quitté.
export default function FeuilleProfilModal({ p, contacts, demande, id }) {
  const router = useRouter();
  return (
    <FeuilleGlissante onFermer={() => router.back()}>
      <ContenuProfil p={p} contacts={contacts} demande={demande} id={id} />
    </FeuilleGlissante>
  );
}
