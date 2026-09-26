import { redirect } from "next/navigation";
import TabBar from "@/components/TabBar";
import { utilisateurCourant } from "@/lib/api";
import Questions from "./Questions";

export const metadata = { title: "Questions aux anciens — LSNO Amicale" };
export const dynamic = "force-dynamic";

// Brique 3 : un membre pose une question (à visage découvert ou anonyme),
// les anciens répondent, l'auteur retient la meilleure réponse.
export default async function PageQuestions() {
  const moi = await utilisateurCourant();
  if (!moi || moi.statut_compte !== "valide") redirect("/connexion");
  return (
    <main className="page avec-tabbar">
      <Questions moi={{ id: moi.id, prenom: moi.prenom, nom: moi.nom, photo: moi.photo_url, role: moi.role }}
        moderateur={moi.role === "admin" || moi.role === "delegue"} />
      <TabBar actif="Fil" />
    </main>
  );
}
