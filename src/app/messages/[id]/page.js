import { redirect } from "next/navigation";
import { utilisateurCourant } from "@/lib/api";
import Conversation from "./Conversation";

export const metadata = { title: "Conversation — LSNO Amicale" };
export const dynamic = "force-dynamic";

// Une conversation en pleine page, sans barre d'onglets (on écrit) : la
// saisie est collée en bas, les messages arrivent en temps réel.
export default async function PageConversation({ params }) {
  const { id } = await params;
  const moi = await utilisateurCourant();
  if (!moi || moi.statut_compte !== "valide") redirect("/connexion");
  return (
    <main className="page">
      <Conversation id={Number(id)} moi={{ id: moi.id, prenom: moi.prenom, nom: moi.nom, photo: moi.photo_url, role: moi.role }} />
    </main>
  );
}
