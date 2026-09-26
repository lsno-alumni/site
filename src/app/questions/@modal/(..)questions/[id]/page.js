import { utilisateurCourant, lireQuestionServeur } from "@/lib/api";
import { nomDomaine } from "@/lib/donnees";
import FeuilleQuestionModal from "./FeuilleQuestionModal";
import FeuillePoserModal from "./FeuillePoserModal";

// Route INTERCEPTÉE : un tap sur une question de la liste ouvre cette feuille
// par-dessus la liste. « nouvelle » (la plume) ouvre le formulaire en feuille :
// l'interception dynamique [id] prend le pas sur une interception (.)nouvelle
// séparée, on l'aiguille donc ici.
export default async function ModalQuestion({ params }) {
  const { id } = await params;
  const moi = await utilisateurCourant();
  if (!moi) return null;
  if (id === "nouvelle") {
    if (moi.statut_compte !== "valide") return null;
    return <FeuillePoserModal moi={{ id: moi.id, prenom: moi.prenom, nom: moi.nom, photo: moi.photo_url, promo: moi.promotions?.numero, domaine: moi.domaine, domaineNom: nomDomaine(moi.domaine, moi.domaine_precision, true) }} />;
  }
  const q = await lireQuestionServeur(id);
  if (!q) return null;
  return <FeuilleQuestionModal q={q} moderateur={moi.role === "admin" || moi.role === "delegue"}
    moi={{ id: moi.id, prenom: moi.prenom, nom: moi.nom, photo: moi.photo_url, role: moi.role }} />;
}
