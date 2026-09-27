import { notFound, redirect } from "next/navigation";
import TabBar from "@/components/TabBar";
import Retour from "@/app/profil/[id]/Retour";
import RafraichirPage from "@/components/RafraichirPage";
import { utilisateurCourant, lireEvenementServeur } from "@/lib/api";
import ContenuEvenement from "./ContenuEvenement";

export const dynamic = "force-dynamic";

// Un événement en pleine page (lien partagé, notification) ; depuis la liste
// ou le Fil, c'est la feuille glissante (@modal) qui s'ouvre à la place.
export default async function PageEvenement({ params }) {
  const { id } = await params;
  const moi = await utilisateurCourant();
  if (!moi || moi.statut_compte !== "valide") redirect("/connexion");
  const e = await lireEvenementServeur(id);
  if (!e) notFound();
  return (
    <main className="page page-profil avec-tabbar">
      <RafraichirPage>
        <div className="pu-page">
          <div className="pu-bandeau"><Retour secours="/evenements" /></div>
          <ContenuEvenement e={e} moderateur={moi.role === "admin" || moi.role === "delegue"}
            moi={{ id: moi.id, prenom: moi.prenom, nom: moi.nom, photo: moi.photo_url, role: moi.role }} />
        </div>
      </RafraichirPage>
      <TabBar actif="Fil" />
    </main>
  );
}
