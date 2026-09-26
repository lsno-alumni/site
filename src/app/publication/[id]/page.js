import { notFound, redirect } from "next/navigation";
import TabBar from "@/components/TabBar";
import Retour from "@/app/profil/[id]/Retour";
import RafraichirPage from "@/components/RafraichirPage";
import { utilisateurCourant } from "@/lib/api";
import ContenuPublication from "./ContenuPublication";
import { FIL_DEMO, COMMENTAIRES_DEMO, MOI } from "@/app/fil/demo";

export const dynamic = "force-dynamic";

// Une publication en pleine page (lien partagé, actualisation) ; depuis le
// Fil, c'est la feuille glissante (fil/@modal) qui s'ouvre à la place.
// MAQUETTE (branche `social`) : données de démonstration.
export default async function PagePublication({ params }) {
  const { id } = await params;
  const moi = await utilisateurCourant();
  if (!moi || moi.statut_compte !== "valide") redirect("/connexion");
  const p = FIL_DEMO.find((x) => x.type === "publication" && String(x.id) === id);
  if (!p) notFound();
  return (
    <main className="page page-profil avec-tabbar">
      <RafraichirPage>
        <div className="pu-page">
          <div className="pu-bandeau"><Retour secours="/fil" /></div>
          <ContenuPublication p={p} commentaires={COMMENTAIRES_DEMO[p.id] ?? []}
            moi={{ prenom: moi.prenom, nom: moi.nom, photo: moi.photo_url ?? MOI.photo }} />
        </div>
      </RafraichirPage>
      <TabBar actif="Fil" />
    </main>
  );
}
