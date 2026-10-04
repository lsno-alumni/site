import { redirect } from "next/navigation";
import TabBar from "@/components/TabBar";
import { utilisateurCourant } from "@/lib/api";
import { nomDomaine } from "@/lib/donnees";
import Fil from "./Fil";

export const metadata = { title: "Le fil — LSNO Amicale" };
export const dynamic = "force-dynamic";

export default async function PageFil() {
  const moi = await utilisateurCourant();
  if (!moi || moi.statut_compte !== "valide") redirect("/connexion");
  return (
    <main className="page avec-tabbar">
      <Fil moi={{ id: moi.id, prenom: moi.prenom, nom: moi.nom, photo: moi.photo_url, role: moi.role, promo: moi.promotions?.numero ?? null, domaine: moi.domaine ? nomDomaine(moi.domaine, moi.domaine_precision, true) : null }}
        moderateur={moi.role === "admin" || moi.role === "delegue"} />
      <TabBar actif="Fil" />
    </main>
  );
}
