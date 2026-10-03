import { notFound, redirect } from "next/navigation";
import TabBar from "@/components/TabBar";
import Retour from "@/app/profil/[id]/Retour";
import RafraichirPage from "@/components/RafraichirPage";
import { utilisateurCourant, lireEvenementServeur } from "@/lib/api";
import ContenuEvenement from "./ContenuEvenement";

export const dynamic = "force-dynamic";
// aperçu de partage GÉNÉRIQUE : les événements sont réservés aux membres
export const metadata = {
  title: "Événement — LSNO Amicale",
  description: "Un événement entre anciens du LSNO, réservé aux membres du réseau.",
  openGraph: { title: "Un événement sur LSNO Amicale", description: "Réservé aux membres du réseau. Connecte-toi pour voir les détails et répondre." },
};

// Un événement en pleine page (lien partagé, notification) ; depuis la liste
// ou le Fil, c'est la feuille glissante (@modal) qui s'ouvre à la place.
export default async function PageEvenement({ params }) {
  const { id } = await params;
  const [moi, e] = await Promise.all([utilisateurCourant(), lireEvenementServeur(id)]);   // en parallèle : deux allers-retours en un
  if (!moi || moi.statut_compte !== "valide") redirect("/connexion");
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
