import { redirect } from "next/navigation";
import TabBar from "@/components/TabBar";
import { utilisateurCourant } from "@/lib/api";
import Fil from "./Fil";

export const metadata = { title: "Le fil — LSNO Amicale" };
export const dynamic = "force-dynamic";

export default async function PageFil() {
  const moi = await utilisateurCourant();
  if (!moi || moi.statut_compte !== "valide") redirect("/connexion");
  return (
    <main className="page avec-tabbar">
      <Fil moi={{ id: moi.id, prenom: moi.prenom, nom: moi.nom, photo: moi.photo_url, role: moi.role }}
        moderateur={moi.role === "admin" || moi.role === "delegue"} />
      <TabBar actif="Fil" />
    </main>
  );
}
