import { redirect } from "next/navigation";
import TabBar from "@/components/TabBar";
import RetourDynamique from "@/components/RetourDynamique";
import { utilisateurCourant } from "@/lib/api";
import Bibliotheque from "./Bibliotheque";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bibliothèque — LSNO Amicale" };

// Annales du bac, devoirs et compositions de l'école, cours, corrigés :
// proposés par les membres, relus par les délégués. Réservé aux membres
// validés, élèves compris.
export default async function PageBibliotheque() {
  const moi = await utilisateurCourant();
  if (!moi || moi.statut_compte !== "valide") redirect("/connexion");
  return (
    <main className="page avec-tabbar">
      <header className="n-tete tete-promo1" style={{ paddingBottom: 18 }}>
        <RetourDynamique secours="/" libelle="Retour" />
        <h1 style={{ marginTop: 8 }}>Annales<br />et <em>sujets</em></h1>
        <p className="cpt">Les sujets du bac et de l&apos;école, gardés par les anciens pour les cadets.</p>
      </header>
      <Bibliotheque moi={{ id: moi.id, role: moi.role }} />
      <TabBar />
    </main>
  );
}
