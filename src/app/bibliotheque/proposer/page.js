import { redirect } from "next/navigation";
import TabBar from "@/components/TabBar";
import RetourDynamique from "@/components/RetourDynamique";
import { utilisateurCourant } from "@/lib/api";
import Proposer from "./Proposer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Proposer un document — LSNO Amicale" };

export default async function PageProposer() {
  const moi = await utilisateurCourant();
  if (!moi || moi.statut_compte !== "valide") redirect("/connexion");
  const moderateur = moi.role === "delegue" || moi.role === "admin";   // publie d'emblée, sans relecture (migration 83)
  return (
    <main className="page avec-tabbar">
      <header className="n-tete tete-promo1" style={{ paddingBottom: 18 }}>
        <RetourDynamique secours="/bibliotheque" libelle="Bibliothèque" />
        <h1 style={{ marginTop: 8 }}>Proposer<br />un <em>document</em></h1>
        <p className="cpt">{moderateur ? "Publié tout de suite dans la bibliothèque." : "Un délégué le relit, puis il rejoint la bibliothèque."}</p>
      </header>
      <Proposer moderateur={moderateur} />
      <TabBar />
    </main>
  );
}
