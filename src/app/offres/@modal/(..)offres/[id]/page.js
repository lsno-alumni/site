import { lireOffre, utilisateurCourant } from "@/lib/api";
import { joursRestants } from "@/lib/offres";
import FeuilleOffreModal from "./FeuilleOffreModal";

// Route INTERCEPTÉE : un tap sur une offre de la liste (Link vers
// /offres/[id]) affiche cette version — une feuille par-dessus la liste —
// au lieu de la vraie page. Un lien partagé, une actualisation ou une
// arrivée depuis une AUTRE page ouvrent toujours la vraie page
// (src/app/offres/[id]/page.js).
export default async function ModalOffre({ params }) {
  const { id } = await params;
  const [o, moi] = await Promise.all([lireOffre(id), utilisateurCourant()]);
  // cas limite (session perdue pendant la navigation) : pas de feuille,
  // la vraie page gère déjà cet état
  if (!o) return null;
  return <FeuilleOffreModal o={o} moiId={moi?.id ?? null} jours={joursRestants(o.date_limite)} />;
}
