import { utilisateurCourant } from "@/lib/api";
import { MOI } from "@/app/fil/demo";
import FeuilleComposerModal from "./FeuilleComposerModal";

// Route INTERCEPTÉE : depuis le Fil, « Quoi de neuf ? » et la plume ouvrent le
// composer en FEUILLE, qui monte du bas et s'ouvre entièrement d'un mouvement.
// Une arrivée directe sur /fil/nouvelle donne la page pleine.
export default async function ModalNouvelle() {
  const moi = await utilisateurCourant();
  if (!moi) return null;
  return <FeuilleComposerModal moi={{ prenom: moi.prenom, nom: moi.nom, photo: moi.photo_url ?? MOI.photo, promo: moi.promotions?.numero }} />;
}
