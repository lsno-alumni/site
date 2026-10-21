import { redirect } from "next/navigation";
import { utilisateurCourant } from "@/lib/api";
import Conversation from "./Conversation";
import Conversations from "../Conversations";
import TabBar from "@/components/TabBar";
import SeulementBureau from "@/components/SeulementBureau";

export const metadata = { title: "Conversation — LSNO Amicale" };
export const dynamic = "force-dynamic";

// Une conversation en pleine page, sans barre d'onglets (on écrit) : la
// saisie est collée en bas, les messages arrivent en temps réel.
export default async function PageConversation({ params }) {
  const { id } = await params;
  const moi = await utilisateurCourant();
  if (!moi || moi.statut_compte !== "valide") redirect("/connexion");
  return (
    <main className="page bu-conv">
      {/* grand écran : la liste des conversations à gauche et le rail — rendus après montage, jamais sur téléphone (requêtes et temps réel en plus) */}
      <SeulementBureau>
        <aside className="bu-conv-liste">
          <Conversations moi={{ id: moi.id, prenom: moi.prenom, nom: moi.nom, photo: moi.photo_url, role: moi.role }} enColonne />
        </aside>
        <TabBar actif="Messages" />
      </SeulementBureau>
      <Conversation id={Number(id)} moi={{ id: moi.id, prenom: moi.prenom, nom: moi.nom, photo: moi.photo_url, role: moi.role }} />
    </main>
  );
}
