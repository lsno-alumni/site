import { utilisateurCourant, lireQuestionServeur } from "@/lib/api";
import FeuilleQuestionModal from "@/app/questions/@modal/(..)questions/[id]/FeuilleQuestionModal";

// Route INTERCEPTÉE depuis le Fil : une carte « question » ouvre la question
// en FEUILLE par-dessus le fil, comme depuis la liste des questions.
export default async function ModalQuestionDepuisFil({ params }) {
  const { id } = await params;
  const moi = await utilisateurCourant();
  if (!moi) return null;
  const q = await lireQuestionServeur(id);
  if (!q) return null;
  return <FeuilleQuestionModal q={q} moderateur={moi.role === "admin" || moi.role === "delegue"}
    moi={{ id: moi.id, prenom: moi.prenom, nom: moi.nom, photo: moi.photo_url, role: moi.role }} />;
}
