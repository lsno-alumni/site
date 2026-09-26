import { redirect } from "next/navigation";
import TabBar from "@/components/TabBar";
import { utilisateurCourant } from "@/lib/api";
import Fil from "./Fil";
import { FIL_DEMO, MOI } from "./demo";

export const metadata = { title: "Le fil — LSNO Amicale" };
export const dynamic = "force-dynamic";

// MAQUETTE (branche `social`) : le Fil avec des données de démonstration.
export default async function PageFil() {
  const moi = await utilisateurCourant();
  if (!moi || moi.statut_compte !== "valide") redirect("/connexion");
  return (
    <main className="page avec-tabbar">
      <Fil moi={{ prenom: moi.prenom, nom: moi.nom, photo: moi.photo_url ?? MOI.photo }} fil={FIL_DEMO} />
      <TabBar actif="Fil" />
    </main>
  );
}
