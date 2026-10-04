import { lireOffre, utilisateurCourant, suiteOffre, lireInteractions } from "@/lib/api";
import { joursRestants } from "@/lib/offres";
import FeuilleOffreModal from "@/app/offres/@modal/(..)offres/[id]/FeuilleOffreModal";

// Route INTERCEPTÉE depuis le Fil : une carte offre ouvre l'offre en FEUILLE
// par-dessus le fil, comme depuis la liste des offres.
export default async function ModalOffreDepuisFil({ params }) {
  const { id } = await params;
  const [o, moi] = await Promise.all([lireOffre(id), utilisateurCourant()]);
  if (!o) return null;
  const [suite, interactions] = await Promise.all([suiteOffre(id, o.domaine), moi ? lireInteractions("offre", id) : null]);
  return <FeuilleOffreModal o={o} moiId={moi?.id ?? null} jours={joursRestants(o.date_limite)} suite={suite} interactions={interactions}
    moi={moi ? { id: moi.id, prenom: moi.prenom, nom: moi.nom, photo: moi.photo_url, role: moi.role } : null}
    moderateur={moi?.role === "admin" || moi?.role === "delegue"} />;
}
