import { utilisateurCourant, lireEvenementServeur } from "@/lib/api";
import FeuilleEvenementModal from "@/app/evenements/@modal/(..)evenements/[id]/FeuilleEvenementModal";

// Route INTERCEPTÉE depuis le Fil : une carte « événement » ouvre l'événement
// en FEUILLE par-dessus le fil, comme depuis la liste des événements.
export default async function ModalEvenementDepuisFil({ params }) {
  const { id } = await params;
  const moi = await utilisateurCourant();
  if (!moi) return null;
  if (id === "nouveau") return null;   // la création se fait en pleine page depuis le Fil
  const e = await lireEvenementServeur(id);
  if (!e) return null;
  return <FeuilleEvenementModal e={e} moderateur={moi.role === "admin" || moi.role === "delegue"}
    moi={{ id: moi.id, prenom: moi.prenom, nom: moi.nom, photo: moi.photo_url, role: moi.role }} />;
}
