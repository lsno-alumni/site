import { redirect } from "next/navigation";
import { utilisateurCourant, lireEvenementServeur } from "@/lib/api";
import { nomDomaine } from "@/lib/donnees";
import { urlMedia } from "@/lib/fil";
import FormulaireEvenement from "./FormulaireEvenement";

export const metadata = { title: "Organiser un événement — LSNO Amicale" };
export const dynamic = "force-dynamic";

// Pleine page (lien direct) ; depuis la liste, c'est la feuille (@modal).
// ?modifier=ID : modification ; ?depuis=ID : copie d'un autre événement.
export default async function PageNouvelEvenement({ searchParams }) {
  const moi = await utilisateurCourant();
  if (!moi || moi.statut_compte !== "valide") redirect("/connexion");
  const { modifier, depuis } = await searchParams;
  const base = modifier || depuis ? await lireEvenementServeur(modifier || depuis) : null;
  const initial = base ? { ...base, ...(depuis ? { id: null, debut: null, fin: null, affiche_chemin: null } : { afficheUrl: base.affiche_chemin ? urlMedia(base.affiche_chemin) : null }) } : null;
  if (modifier && (!base || !base.est_moi)) redirect("/evenements");
  return (
    <main className="page">
      <FormulaireEvenement initial={initial} modifier={Boolean(modifier)}
        moi={{ id: moi.id, prenom: moi.prenom, nom: moi.nom, photo: moi.photo_url, role: moi.role, promo: moi.promotions?.numero, domaineNom: nomDomaine(moi.domaine, moi.domaine_precision, true) }} />
    </main>
  );
}
