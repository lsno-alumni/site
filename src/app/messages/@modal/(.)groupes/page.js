import { utilisateurCourant } from "@/lib/api";
import FeuilleGroupesModal from "./FeuilleGroupesModal";

// Route INTERCEPTÉE : « Découvrir des groupes » s'ouvre en feuille par-dessus
// la liste des messages.
export default async function ModalGroupes() {
  const moi = await utilisateurCourant();
  if (!moi || moi.statut_compte !== "valide") return null;
  return <FeuilleGroupesModal />;
}
