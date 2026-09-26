import { utilisateurCourant } from "@/lib/api";
import { FIL_DEMO, COMMENTAIRES_DEMO, MOI } from "@/app/fil/demo";
import FeuillePublicationModal from "./FeuillePublicationModal";

// Route INTERCEPTÉE : un tap sur une publication du Fil (Link vers
// /publication/[id]) ouvre cette feuille par-dessus le fil.
export default async function ModalPublication({ params }) {
  const { id } = await params;
  const moi = await utilisateurCourant();
  const p = FIL_DEMO.find((x) => x.type === "publication" && String(x.id) === id);
  if (!p || !moi) return null;
  return <FeuillePublicationModal p={p} commentaires={COMMENTAIRES_DEMO[p.id] ?? []}
    moi={{ prenom: moi.prenom, nom: moi.nom, photo: moi.photo_url ?? MOI.photo }} />;
}
