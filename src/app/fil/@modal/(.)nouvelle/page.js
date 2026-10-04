import { utilisateurCourant } from "@/lib/api";
import { nomDomaine } from "@/lib/donnees";
import FeuilleComposerModal from "./FeuilleComposerModal";

// Route INTERCEPTÉE : depuis le Fil, « Quoi de neuf ? » et la plume ouvrent le
// composer en FEUILLE, qui monte du bas et s'ouvre entièrement d'un mouvement.
// Une arrivée directe sur /fil/nouvelle donne la page pleine.
export default async function ModalNouvelle() {
  const moi = await utilisateurCourant();
  if (!moi || moi.statut_compte !== "valide") return null;
  return <FeuilleComposerModal moi={{ prenom: moi.prenom, nom: moi.nom, photo: moi.photo_url, promo: moi.promotions?.numero, domaine: nomDomaine(moi.domaine, moi.domaine_precision, true) }} />;
}
