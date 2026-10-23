import { redirect } from "next/navigation";
import { utilisateurCourant } from "@/lib/api";
import { nomDomaine } from "@/lib/donnees";
import PoserQuestion from "./PoserQuestion";
import TabBar from "@/components/TabBar";
import SeulementBureau from "@/components/SeulementBureau";

export const metadata = { title: "Poser une question — LSNO Amicale" };
export const dynamic = "force-dynamic";

export default async function PageNouvelleQuestion() {
  const moi = await utilisateurCourant();
  if (!moi || moi.statut_compte !== "valide") redirect("/connexion");
  return (
    <main className="page bu-formulaire">
      <PoserQuestion moi={{ id: moi.id, prenom: moi.prenom, nom: moi.nom, photo: moi.photo_url, promo: moi.promotions?.numero, domaine: moi.domaine, domaineNom: nomDomaine(moi.domaine, moi.domaine_precision, true) }} />
      {/* grand écran seulement : le rail reste là (sur téléphone, ces écrans sont des feuilles sans barre) */}
      <SeulementBureau><TabBar actif="Fil" /></SeulementBureau>
    </main>
  );
}
