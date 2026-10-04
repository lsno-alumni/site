import { redirect } from "next/navigation";
import TabBar from "@/components/TabBar";
import { utilisateurCourant } from "@/lib/api";
import Conversations from "./Conversations";

export const metadata = { title: "Messages — LSNO Amicale" };
export const dynamic = "force-dynamic";

// Brique 2 : conversations à deux et groupes, entre membres validés. Les
// messages s'effacent après 30 jours ; les groupes restent.
export default async function PageMessages() {
  const moi = await utilisateurCourant();
  if (!moi || moi.statut_compte !== "valide") redirect("/connexion");
  return (
    <main className="page avec-tabbar">
      <Conversations moi={{ id: moi.id, prenom: moi.prenom, nom: moi.nom, photo: moi.photo_url, role: moi.role }} />
      <TabBar actif="Messages" />
    </main>
  );
}
