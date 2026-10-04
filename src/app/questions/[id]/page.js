import { notFound, redirect } from "next/navigation";
import TabBar from "@/components/TabBar";
import Retour from "@/app/profil/[id]/Retour";
import RafraichirPage from "@/components/RafraichirPage";
import { utilisateurCourant, lireQuestionServeur } from "@/lib/api";
import ContenuQuestion from "./ContenuQuestion";

export const dynamic = "force-dynamic";

// Une question en pleine page (lien partagé, notification) ; depuis la liste,
// c'est la feuille glissante (questions/@modal) qui s'ouvre à la place.
export default async function PageQuestion({ params }) {
  const { id } = await params;
  const [moi, q] = await Promise.all([utilisateurCourant(), lireQuestionServeur(id)]);   // en parallèle : deux allers-retours en un
  if (!moi || moi.statut_compte !== "valide") redirect("/connexion");
  if (!q) notFound();
  return (
    <main className="page page-profil avec-tabbar">
      <RafraichirPage>
        <div className="pu-page">
          <div className="pu-bandeau"><Retour secours="/questions" /></div>
          <ContenuQuestion q={q} moderateur={moi.role === "admin" || moi.role === "delegue"}
            moi={{ id: moi.id, prenom: moi.prenom, nom: moi.nom, photo: moi.photo_url, role: moi.role }} />
        </div>
      </RafraichirPage>
      <TabBar actif="Fil" />
    </main>
  );
}
