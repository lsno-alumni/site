import { redirect } from "next/navigation";
import { utilisateurCourant } from "@/lib/api";
import { nomDomaine } from "@/lib/donnees";
import Composer from "./Composer";

export const metadata = { title: "Publier — LSNO Amicale" };
export const dynamic = "force-dynamic";

// Écrire une publication : une page à part entière, plein écran, sans barre
// d'onglets (on est en train d'écrire).
export default async function PageNouvelle() {
  const moi = await utilisateurCourant();
  if (!moi || moi.statut_compte !== "valide") redirect("/connexion");
  return (
    <main className="page">
      <Composer moi={{ prenom: moi.prenom, nom: moi.nom, photo: moi.photo_url, promo: moi.promotions?.numero, domaine: nomDomaine(moi.domaine, moi.domaine_precision, true) }} />
    </main>
  );
}
