import { utilisateurCourant } from "@/lib/api";
import FeuilleNouvelleModal from "./FeuilleNouvelleModal";

// Route INTERCEPTÉE : le « + » de la liste des messages ouvre le choix des
// membres en feuille par-dessus la liste, au lieu d'une page qui surgit.
// L'adresse /messages/nouveau ouverte directement reste une pleine page.
export default async function ModalNouvelleConversation() {
  const moi = await utilisateurCourant();
  if (!moi || moi.statut_compte !== "valide") return null;
  return <FeuilleNouvelleModal />;
}
