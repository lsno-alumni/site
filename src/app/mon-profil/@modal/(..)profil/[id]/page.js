import { lireProfil, lireContacts, statutDemande, profilsVoisins } from "@/lib/api";
import FeuilleProfilModal from "@/app/annuaire/@modal/(..)profil/[id]/FeuilleProfilModal";

// Route INTERCEPTÉE depuis /mon-profil : l'aperçu de son propre profil, tel
// que les autres le voient, dans la même feuille glissante que l'annuaire.
export default async function ModalProfilDepuisMonProfil({ params }) {
  const { id } = await params;
  const [p, contacts, demande] = await Promise.all([lireProfil(id), lireContacts(id), statutDemande(id)]);
  if (!p) return null;
  const voisins = await profilsVoisins(id, p.promotion, p.domaine);
  return <FeuilleProfilModal p={p} contacts={contacts} demande={demande} id={id} voisins={voisins} />;
}
