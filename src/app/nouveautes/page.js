import { redirect } from "next/navigation";
import TabBar from "@/components/TabBar";
import { utilisateurCourant } from "@/lib/api";
import Nouveautes from "./Nouveautes";

export const metadata = { title: "Nouveautés — LSNO Amicale" };
export const dynamic = "force-dynamic";

// Ce que le réseau social apporte, et comment s'en servir. Réservé aux membres.
export default async function PageNouveautes() {
  const moi = await utilisateurCourant();
  if (!moi || moi.statut_compte !== "valide") redirect("/connexion");
  return (
    <main className="page avec-tabbar">
      <Nouveautes />
      <TabBar actif="Fil" />
    </main>
  );
}
