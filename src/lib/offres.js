// Vocabulaire et petits calculs partagés par la liste des offres, la page
// d'une offre et sa feuille glissante.
export const TYPES = [
  { cle: "stage", nom: "Stage" },
  { cle: "emploi", nom: "Emploi" },
  { cle: "bourse", nom: "Bourse" },
  { cle: "cooptation", nom: "Cooptation" },
  { cle: "concours", nom: "Concours" },
  { cle: "autre", nom: "Autre" },
];
export const nomType = (cle) => TYPES.find((t) => t.cle === cle)?.nom ?? cle;

// Une date limite est une DATE (« 2026-11-01 »), sans heure : on la lit à midi
// local pour qu'un fuseau à l'ouest de Greenwich ne la fasse pas reculer
// d'un jour.
export function dateLimite(date) {
  return date ? new Date(`${date}T12:00:00`) : null;
}

// jours restants avant l'échéance : 0 = dernier jour, null = pas d'échéance
export function joursRestants(date) {
  const cible = dateLimite(date);
  if (!cible) return null;
  const auj = new Date();
  auj.setHours(12, 0, 0, 0);
  return Math.round((cible - auj) / 86400000);
}

export function echeanceLongue(date) {
  const d = dateLimite(date);
  return d ? d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : null;
}

// URL publique d'une pièce jointe (bucket « ressources », public en lecture)
export function urlFichier(chemin) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ressources/${chemin}`;
}

export function ilYA(date) {
  const j = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (j <= 0) return "aujourd'hui";
  if (j === 1) return "hier";
  return `il y a ${j} j`;
}
