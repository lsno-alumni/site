import { redirect } from "next/navigation";
import { utilisateurCourant } from "@/lib/api";
import { nomDomaine } from "@/lib/donnees";
import PoserQuestion from "./PoserQuestion";

export const metadata = { title: "Poser une question — LSNO Amicale" };
export const dynamic = "force-dynamic";

export default async function PageNouvelleQuestion() {
  const moi = await utilisateurCourant();
  if (!moi || moi.statut_compte !== "valide") redirect("/connexion");
  return (
    <main className="page">
      <PoserQuestion moi={{ id: moi.id, prenom: moi.prenom, nom: moi.nom, photo: moi.photo_url, promo: moi.promotions?.numero, domaine: moi.domaine, domaineNom: nomDomaine(moi.domaine, moi.domaine_precision, true) }} />
    </main>
  );
}
