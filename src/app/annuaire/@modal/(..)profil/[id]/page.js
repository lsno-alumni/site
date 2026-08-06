import { lireProfil, lireContacts, statutDemande } from "@/lib/api";
import FeuilleProfilModal from "./FeuilleProfilModal";

// Route INTERCEPTÉE : un clic sur une fiche de l'annuaire (Link vers
// /profil/[id]) affiche cette version — une feuille par-dessus la liste —
// au lieu de la vraie page. Un lien partagé, une actualisation ou une
// arrivée depuis une AUTRE page ouvrent toujours la vraie page
// (src/app/profil/[id]/page.js), inchangée.
export default async function ModalProfil({ params }) {
  const { id } = await params;
  const [p, contacts, demande] = await Promise.all([
    lireProfil(id),
    lireContacts(id),
    statutDemande(id),
  ]);
  // cas limite (session perdue pendant la navigation) : pas de feuille,
  // la vraie page /profil/[id] gère déjà cet état correctement
  if (!p) return null;

  return <FeuilleProfilModal p={p} contacts={contacts} demande={demande} id={id} />;
}
