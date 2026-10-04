import { utilisateurCourant, lireEvenementServeur } from "@/lib/api";
import { nomDomaine } from "@/lib/donnees";
import { urlMedia } from "@/lib/fil";
import FeuilleEvenementModal from "./FeuilleEvenementModal";
import FeuilleCreerModal from "./FeuilleCreerModal";

// Route INTERCEPTÉE : un tap sur un événement de la liste ouvre cette feuille
// par-dessus la liste. « nouveau » (la plume, Modifier, Dupliquer) ouvre le
// formulaire en feuille : l'interception dynamique [id] prend le pas sur une
// interception (.)nouveau séparée, on l'aiguille donc ici.
export default async function ModalEvenement({ params, searchParams }) {
  const { id } = await params;
  const moi = await utilisateurCourant();
  if (!moi) return null;
  const moiCourt = { id: moi.id, prenom: moi.prenom, nom: moi.nom, photo: moi.photo_url, role: moi.role, promo: moi.promotions?.numero, domaineNom: nomDomaine(moi.domaine, moi.domaine_precision, true) };
  if (id === "nouveau") {
    if (moi.statut_compte !== "valide") return null;
    const { modifier, depuis } = await searchParams;
    const base = modifier || depuis ? await lireEvenementServeur(modifier || depuis) : null;
    if (modifier && (!base || !base.est_moi)) return null;
    const initial = base ? { ...base, ...(depuis ? { id: null, debut: null, fin: null, affiche_chemin: null } : { afficheUrl: base.affiche_chemin ? urlMedia(base.affiche_chemin) : null }) } : null;
    return <FeuilleCreerModal moi={moiCourt} initial={initial} modifier={Boolean(modifier)} />;
  }
  const e = await lireEvenementServeur(id);
  if (!e) return null;
  return <FeuilleEvenementModal e={e} moderateur={moi.role === "admin" || moi.role === "delegue"}
    moi={{ id: moi.id, prenom: moi.prenom, nom: moi.nom, photo: moi.photo_url, role: moi.role }} />;
}
