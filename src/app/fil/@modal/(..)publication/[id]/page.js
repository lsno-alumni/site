import { utilisateurCourant, lirePublication } from "@/lib/api";
import FeuillePublicationModal from "./FeuillePublicationModal";

// Route INTERCEPTÉE : un tap sur une publication du Fil (Link vers
// /publication/[id]) ouvre cette feuille par-dessus le fil.
export default async function ModalPublication({ params }) {
  const { id } = await params;
  const moi = await utilisateurCourant();
  if (!moi) return null;
  const r = await lirePublication(id);
  if (!r) return null;
  return <FeuillePublicationModal p={r.publication} commentaires={r.commentaires}
    moderateur={moi.role === "admin" || moi.role === "delegue"}
    moi={{ id: moi.id, prenom: moi.prenom, nom: moi.nom, photo: moi.photo_url }} />;
}
