import { lireProfil, lireContacts, statutDemande, profilsVoisins } from "@/lib/api";
import FeuilleProfilModal from "@/app/annuaire/@modal/(..)profil/[id]/FeuilleProfilModal";

// Route INTERCEPTÉE depuis /conseils : un tap sur l'auteur d'un conseil
// (Link vers /profil/[id]) ouvre la même feuille glissante que l'annuaire,
// par-dessus la liste — on retrouve sa place en la fermant.
export default async function ModalProfilDepuisConseils({ params }) {
  const { id } = await params;
  const [p, contacts, demande] = await Promise.all([lireProfil(id), lireContacts(id), statutDemande(id)]);
  if (!p) return null;
  const voisins = await profilsVoisins(id, p.promotion, p.domaine);
  return <FeuilleProfilModal p={p} contacts={contacts} demande={demande} id={id} voisins={voisins} />;
}
