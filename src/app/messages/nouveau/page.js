import { redirect } from "next/navigation";
import { utilisateurCourant } from "@/lib/api";
import { Suspense } from "react";
import NouvelleConversation from "./NouvelleConversation";

export const metadata = { title: "Nouvelle conversation — LSNO Amicale" };
export const dynamic = "force-dynamic";

// Choisir avec qui parler : une personne = conversation à deux (retrouvée si
// elle existe déjà) ; plusieurs = un groupe, qu'on nomme.
export default async function PageNouvelleConversation() {
  const moi = await utilisateurCourant();
  if (!moi || moi.statut_compte !== "valide") redirect("/connexion");
  return (
    <main className="page">
      <Suspense fallback={null}><NouvelleConversation /></Suspense>
    </main>
  );
}
