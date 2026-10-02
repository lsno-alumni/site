import { notFound, redirect } from "next/navigation";
import TabBar from "@/components/TabBar";
import Retour from "@/app/profil/[id]/Retour";
import RafraichirPage from "@/components/RafraichirPage";
import { utilisateurCourant, lirePublication } from "@/lib/api";
import ContenuPublication from "./ContenuPublication";

export const dynamic = "force-dynamic";

// Une publication en pleine page (lien partagé, actualisation) ; depuis le
// Fil, c'est la feuille glissante (fil/@modal) qui s'ouvre à la place.
export default async function PagePublication({ params }) {
  const { id } = await params;
  const [moi, r] = await Promise.all([utilisateurCourant(), lirePublication(id)]);   // en parallèle : deux allers-retours en un
  if (!moi || moi.statut_compte !== "valide") redirect("/connexion");
  if (!r) notFound();
  const moderateur = moi.role === "admin" || moi.role === "delegue";
  if (r.publication.masquee && !moderateur && r.publication.auteur.id !== moi.id) notFound();
  return (
    <main className="page page-profil avec-tabbar">
      <RafraichirPage>
        <div className="pu-page">
          <div className="pu-bandeau"><Retour secours="/fil" /></div>
          <ContenuPublication p={r.publication} commentaires={r.commentaires} moderateur={moderateur}
            moi={{ id: moi.id, prenom: moi.prenom, nom: moi.nom, photo: moi.photo_url, role: moi.role }} />
        </div>
      </RafraichirPage>
      <TabBar actif="Fil" />
    </main>
  );
}
