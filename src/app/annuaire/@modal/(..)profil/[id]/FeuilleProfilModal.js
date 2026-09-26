"use client";

import { useRouter } from "next/navigation";
import FeuilleGlissante from "@/components/FeuilleGlissante";
import { CouvertureProfil, TeteProfil, SuiteProfil } from "@/app/profil/[id]/ContenuProfil";

// Fermer la feuille = revenir en arrière : Next quitte alors la route
// interceptée et retrouve l'annuaire tel qu'il était (scroll compris),
// sans jamais l'avoir vraiment quitté.
//
// La feuille sépare TÊTE (couverture + identité, purement visuelle — c'est
// la zone qu'on peut glisser) de SUITE (boutons, parcours, contacts — zone
// interactive, jamais glissable, seulement défilante une fois dépliée).
export default function FeuilleProfilModal({ p, contacts, demande, id, voisins }) {
  const router = useRouter();
  return (
    <FeuilleGlissante
      onFermer={() => router.back()}
      tete={<>
        <CouvertureProfil p={p} />
        <TeteProfil p={p} />
      </>}
    >
      <SuiteProfil p={p} contacts={contacts} demande={demande} id={id} voisins={voisins} />
    </FeuilleGlissante>
  );
}
