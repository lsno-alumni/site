import { redirect } from "next/navigation";
import { utilisateurCourant } from "@/lib/api";
import Groupes from "./Groupes";

export const metadata = { title: "Découvrir des groupes — LSNO Amicale" };
export const dynamic = "force-dynamic";

// Pleine page (lien direct, notification) ; depuis la liste des messages,
// c'est la feuille (@modal/(.)groupes) qui s'ouvre.
export default async function PageGroupes() {
  const moi = await utilisateurCourant();
  if (!moi || moi.statut_compte !== "valide") redirect("/connexion");
  return (
    <main className="page">
      <Groupes />
    </main>
  );
}
