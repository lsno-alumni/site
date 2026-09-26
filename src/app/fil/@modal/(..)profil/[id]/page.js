import { lireProfil, lireContacts, statutDemande, profilsVoisins } from "@/lib/api";
import FeuilleProfilModal from "@/app/annuaire/@modal/(..)profil/[id]/FeuilleProfilModal";

// Route INTERCEPTÉE depuis le Fil : l'auteur d'une publication, un nouvel
// arrivant, l'auteur d'un conseil ou d'un commentaire s'ouvrent en FEUILLE
// par-dessus le fil, comme depuis l'annuaire (même feuille, même contenu).
export default async function ModalProfilDepuisFil({ params }) {
  const { id } = await params;
  const [p, contacts, demande] = await Promise.all([lireProfil(id), lireContacts(id), statutDemande(id)]);
  if (!p) return null;
  const voisins = await profilsVoisins(id, p.promotion, p.domaine);
  return <FeuilleProfilModal p={p} contacts={contacts} demande={demande} id={id} voisins={voisins} />;
}
