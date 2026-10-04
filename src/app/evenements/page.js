import { redirect } from "next/navigation";
import TabBar from "@/components/TabBar";
import { utilisateurCourant } from "@/lib/api";
import Evenements from "./Evenements";

export const metadata = { title: "Événements — LSNO Amicale" };
export const dynamic = "force-dynamic";

// Brique 5 : un membre organise une rencontre, les autres répondent.
export default async function PageEvenements() {
  const moi = await utilisateurCourant();
  if (!moi || moi.statut_compte !== "valide") redirect("/connexion");
  return (
    <main className="page avec-tabbar">
      <Evenements />
      <TabBar actif="Fil" />
    </main>
  );
}
