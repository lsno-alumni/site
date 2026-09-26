import { utilisateurCourant, lireQuestionServeur } from "@/lib/api";
import FeuilleQuestionModal from "./FeuilleQuestionModal";

// Route INTERCEPTÉE : un tap sur une question de la liste ouvre cette feuille
// par-dessus la liste.
export default async function ModalQuestion({ params }) {
  const { id } = await params;
  const moi = await utilisateurCourant();
  if (!moi) return null;
  const q = await lireQuestionServeur(id);
  if (!q) return null;
  return <FeuilleQuestionModal q={q} moderateur={moi.role === "admin" || moi.role === "delegue"}
    moi={{ id: moi.id, prenom: moi.prenom, nom: moi.nom, photo: moi.photo_url, role: moi.role }} />;
}
