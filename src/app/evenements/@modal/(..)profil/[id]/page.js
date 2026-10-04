import { lireProfil, lireContacts, statutDemande, profilsVoisins } from "@/lib/api";
import FeuilleProfilModal from "@/app/annuaire/@modal/(..)profil/[id]/FeuilleProfilModal";

// Route INTERCEPTÉE depuis les événements : l'organisateur ou un participant
// s'ouvre en FEUILLE profil, comme depuis l'annuaire.
export default async function ModalProfilDepuisEvenements({ params }) {
  const { id } = await params;
  const [p, contacts, demande] = await Promise.all([lireProfil(id), lireContacts(id), statutDemande(id)]);
  if (!p) return null;
  const voisins = await profilsVoisins(id, p.promotion, p.domaine);
  return <FeuilleProfilModal p={p} contacts={contacts} demande={demande} id={id} voisins={voisins} />;
}
