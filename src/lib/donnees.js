// ============================================================
// Couche de données LSNO Amicale.
// Aujourd'hui : données de démonstration en mémoire.
// Demain : chaque fonction bascule sur Supabase (même signature),
// le reste de l'application ne change pas.
// ============================================================

export const DOMAINES = [
  { cle: "info", nom: "Informatique & numérique", detail: "Dév, data, cybersécurité…" },
  { cle: "sante", nom: "Santé & médecine", detail: "Médecine, pharmacie…" },
  { cle: "inge", nom: "Ingénierie", detail: "Génie civil, élec, méca…" },
  { cle: "maths", nom: "Maths & recherche", detail: "Prépa, enseignement sup…" },
  { cle: "eco", nom: "Économie & finance", detail: "Éco, gestion, banque…" },
  { cle: "agro", nom: "Agronomie & environnement", detail: "Agro, eau, énergie…" },
  { cle: "enseignement", nom: "Enseignement", detail: "Professorat, pédagogie…" },
  { cle: "droit", nom: "Droit & sciences politiques", detail: "Magistrature, barreau, administration…" },
  { cle: "defense", nom: "Défense & sécurité", detail: "Armée, gendarmerie, police, douanes…" },
  { cle: "arts", nom: "Arts, communication & médias", detail: "Journalisme, design, audiovisuel…" },
  { cle: "autre", nom: "Autre", detail: "Tous les autres horizons" },
];

export const SITUATIONS = [
  { cle: "etudiant", nom: "Étudiant·e" },
  { cle: "emploi", nom: "En emploi" },
  { cle: "entrepreneur", nom: "Entrepreneur·e" },
  { cle: "recherche", nom: "En recherche" },
];

export const PAYS = {
  BF: { nom: "Burkina Faso", drapeau: "/img/v3_00.png" },
  MA: { nom: "Maroc", drapeau: "/img/v3_01.png" },
  FR: { nom: "France", drapeau: "/img/v3_02.png" },
  CA: { nom: "Canada", drapeau: "/img/v3_03.png" },
  SN: { nom: "Sénégal", drapeau: "/img/v3_04.png" },
};

// Liste de sélection du profil (destinations fréquentes des anciens).
// Un pays sans drapeau dans PAYS s'affiche simplement sans icône.
export const LISTE_PAYS = [
  ["BF", "Burkina Faso"], ["MA", "Maroc"], ["SN", "Sénégal"], ["CI", "Côte d'Ivoire"],
  ["TN", "Tunisie"], ["DZ", "Algérie"], ["TG", "Togo"], ["BJ", "Bénin"],
  ["NE", "Niger"], ["ML", "Mali"], ["GH", "Ghana"], ["CM", "Cameroun"],
  ["RW", "Rwanda"], ["ZA", "Afrique du Sud"], ["EG", "Égypte"],
  ["FR", "France"], ["BE", "Belgique"], ["DE", "Allemagne"], ["CH", "Suisse"],
  ["GB", "Royaume-Uni"], ["US", "États-Unis"], ["CA", "Canada"],
  ["CN", "Chine"], ["JP", "Japon"], ["TR", "Turquie"], ["RU", "Russie"],
  ["SA", "Arabie saoudite"], ["AE", "Émirats arabes unis"], ["XX", "Autre pays"],
];

export function nomPays(code) {
  return LISTE_PAYS.find(([c]) => c === code)?.[1] ?? code;
}

// Calendrier vivant des promotions — rien à retoucher chaque année :
//  - P1 entrée en octobre 2017, bac 3 ans plus tard ; une nouvelle promo
//    entre chaque OCTOBRE (la liste s'allonge d'elle-même) ;
//  - une promo cesse d'être « en cours » dès JUILLET de son année de bac
//    (sortie fin juin).
const _auj = new Date();
const _annee = _auj.getFullYear();
const _mois = _auj.getMonth() + 1;
export const PROMOTIONS = Array.from(
  { length: _annee - 2017 + (_mois >= 10 ? 1 : 0) },
  (_, i) => {
    const anneeBac = 2020 + i;
    const ecart = anneeBac - _annee; // années civiles avant le bac
    return {
      numero: i + 1,
      anneeEntree: 2017 + i,
      anneeBac,
      enCours: anneeBac > _annee || (anneeBac === _annee && _mois < 7),
      // Inscription réservée à partir de la PREMIÈRE (vote 20/07) : une promo
      // en seconde (écart +3, ou +2 avant la rentrée d'octobre) est bloquée ;
      // elle se débloque à la rentrée d'octobre où elle passe en première.
      autoriseeInscription: ecart < 2 || (ecart === 2 && _mois >= 10),
      // Encore élève (au lycée) : bac à venir, ou bac cette année mais avant
      // la rentrée d'octobre. Bascule en ANCIEN dès la rentrée d'octobre qui
      // suit le bac (entrée dans le supérieur) → il a alors un domaine.
      eleveActuel: anneeBac > _annee || (anneeBac === _annee && _mois < 10),
    };
  }
);

// Nom de domaine à afficher : la précision saisie remplace « Autre »
// (le filtre, lui, continue de regrouper sous Autre).
// Encore élève au lycée ? Déterminé par la promotion + la date (bascule en
// ancien à la rentrée d'octobre suivant le bac). anneeBac = 2019 + numero.
export function estEncoreEleve(promoNumero) {
  if (!promoNumero) return false;
  const anneeBac = 2019 + Number(promoNumero);
  const d = new Date();
  const a = d.getFullYear(), m = d.getMonth() + 1;
  return anneeBac > a || (anneeBac === a && m < 10);
}

// Taux de complétion du profil — UNE seule source de vérité, utilisée par
// Mon profil ET l'accueil connecté (sinon deux calculs divergent). Un élève
// n'a ni poste ni conseil : on ne les compte pas pour lui.
export function tauxCompletion(p) {
  const champs = estEncoreEleve(p?.promotions?.numero)
    ? ["ville", "pays", "photo_url"]
    : ["statut_titre", "ville", "pays", "conseil", "photo_url"];
  const remplis = champs.filter((c) => p?.[c]).length;
  return Math.round(((remplis + 3) / (champs.length + 3)) * 100);
}

export function nomDomaine(cle, precision, court = false) {
  if (cle === "eleve") return "Élève";
  if (cle === "autre" && precision) return precision;
  const nom = DOMAINES.find((d) => d.cle === cle)?.nom ?? cle;
  return court ? nom.split(" &")[0] : nom;
}

// Thèmes proposés pour ranger son conseil aux cadets (choix unique ;
// « Autre » ouvre un champ libre). « Général » = défaut si rien de choisi.
export const THEMES_CONSEIL = [
  "Orientation post-bac",
  "Choix de filière",
  "Bourses & financements",
  "Études à l'étranger",
  "Classes préparatoires",
  "Concours d'entrée",
  "Vie étudiante",
  "Le métier au quotidien",
  "Réussir au LSNO",
];

// Sujets proposés pour « discuter avec les cadets » (le membre peut
// aussi ajouter les siens ; 8 au total max, appliqué en base)
export const SUJETS_CADETS = [
  "Orientation post-bac",
  "Études à l'étranger",
  "Bourses & financements",
  "Classes préparatoires",
  "Concours d'entrée",
  "Mon métier au quotidien",
  "Choix de filière",
  "Vie étudiante",
  "Premier emploi & CV",
  "Entrepreneuriat",
];

// --- profils de démonstration (remplacés par la base réelle) ---
const PROFILS = [
  {
    id: "abdoul", prenom: "Abdoul", nom: "S.", photo: "/img/av1.jpg",
    promotion: 1, domaine: "info", situation: "emploi", pays: "FR", ville: "Paris",
    role: "delegue", repondAuxCadets: true,
    statut: "Ingénieur cybersécurité · Orange",
    conseil: "Le réseau fait la moitié du chemin. Écrivez aux aînés, on a tous été à votre place.",
    parcours: [
      { annees: "2024 — aujourd'hui", titre: "Ingénieur cybersécurité", detail: "Orange Cyberdefense, Paris", actuel: true },
      { annees: "2021 — 2024", titre: "Cycle ingénieur cybersécurité", detail: "École d'ingénieurs, France" },
      { annees: "2017 — 2020", titre: "LSNO — Promotion 1", detail: "Bac série C" },
    ],
    contacts: { whatsapp: "membres", linkedin: "membres", email: "demande" },
  },
  {
    id: "rasmata", prenom: "Rasmata", nom: "Z.", photo: "/img/av2.jpg",
    promotion: 2, domaine: "info", situation: "etudiant", pays: "CA", ville: "Montréal",
    role: "membre", repondAuxCadets: true,
    statut: "Data scientist — en master 2 IA à Montréal",
    conseil: "Ne choisis pas une filière parce qu'elle impressionne. Choisis celle où tu resteras curieux dans dix ans.",
    parcours: [
      { annees: "2025 — aujourd'hui", titre: "Master 2 Intelligence artificielle", detail: "Université de Montréal · bourse d'exemption Québec", actuel: true },
      { annees: "2023 — 2025", titre: "Licence Maths-Informatique", detail: "Université Joseph Ki-Zerbo, Ouagadougou" },
      { annees: "2021 — 2023", titre: "Classes préparatoires MPSI", detail: "Ouagadougou" },
      { annees: "2018 — 2021", titre: "LSNO — Promotion 2", detail: "Bac série C, mention Très bien" },
    ],
    contacts: { whatsapp: "membres", linkedin: "membres", email: "demande" },
  },
  {
    id: "ibrahim", prenom: "Ibrahim", nom: "O.", photo: "/img/av3.jpg",
    promotion: 3, domaine: "info", situation: "emploi", pays: "BF", ville: "Ouaga",
    role: "membre", repondAuxCadets: false,
    statut: "Développeur full-stack · Fintech",
    conseil: "",
    parcours: [
      { annees: "2025 — aujourd'hui", titre: "Développeur full-stack", detail: "Startup fintech, Ouagadougou", actuel: true },
      { annees: "2019 — 2022", titre: "LSNO — Promotion 3", detail: "Bac série C" },
    ],
    contacts: { whatsapp: "masque", linkedin: "membres", email: "masque" },
  },
  {
    id: "fatimata", prenom: "Fatimata", nom: "K.", photo: "/img/av4.jpg",
    promotion: 4, domaine: "inge", situation: "etudiant", pays: "MA", ville: "Rabat",
    role: "membre", repondAuxCadets: true,
    statut: "Élève-ingénieure génie civil · EHTP",
    conseil: "Un ancien m'a orientée vers la bourse qui a changé ma vie. C'est exactement pour ça que ce réseau existe.",
    parcours: [
      { annees: "2024 — aujourd'hui", titre: "Cycle ingénieur génie civil", detail: "EHTP, Rabat · bourse AMCI", actuel: true },
      { annees: "2020 — 2023", titre: "LSNO — Promotion 4", detail: "Bac série C" },
    ],
    contacts: { whatsapp: "membres", linkedin: "membres", email: "membres" },
  },
  {
    id: "awa", prenom: "Awa", nom: "D.", photo: "/img/av5.jpg",
    promotion: 5, domaine: "sante", situation: "etudiant", pays: "BF", ville: "Ouaga",
    role: "membre", repondAuxCadets: false,
    statut: "Étudiante en médecine · UJKZ",
    conseil: "",
    parcours: [
      { annees: "2024 — aujourd'hui", titre: "Médecine", detail: "Université Joseph Ki-Zerbo", actuel: true },
      { annees: "2021 — 2024", titre: "LSNO — Promotion 5", detail: "Bac série C" },
    ],
    contacts: { whatsapp: "demande", linkedin: "masque", email: "demande" },
  },
  {
    id: "salif", prenom: "Salif", nom: "B.", photo: null,
    promotion: 2, domaine: "maths", situation: "etudiant", pays: "SN", ville: "Dakar",
    role: "membre", repondAuxCadets: true,
    statut: "Doctorant en cryptographie",
    conseil: "Les maths du LSNO suffisent pour viser n'importe quelle prépa. Osez.",
    parcours: [
      { annees: "2025 — aujourd'hui", titre: "Doctorat en cryptographie", detail: "UCAD, Dakar", actuel: true },
      { annees: "2018 — 2021", titre: "LSNO — Promotion 2", detail: "Bac série C" },
    ],
    contacts: { whatsapp: "membres", linkedin: "masque", email: "demande" },
  },
];

const DEMANDES = [
  { id: "d1", prenom: "Moussa", nom: "C.", photo: null, promotion: 3, anneeBac: 2022 },
  { id: "d2", prenom: "Awa", nom: "D.", photo: "/img/av5.jpg", promotion: 3, anneeBac: 2022 },
  { id: "d3", prenom: "Karim", nom: "T.", photo: null, promotion: 3, anneeBac: 2022 },
];

// ---- API de données (signatures stables, implémentation Supabase à venir) ----

export async function listeMembres({ domaine, promotion, pays, situation, q } = {}) {
  let r = PROFILS;
  if (domaine && domaine !== "tous") r = r.filter((p) => p.domaine === domaine);
  if (promotion) r = r.filter((p) => p.promotion === Number(promotion));
  if (pays) r = r.filter((p) => p.pays === pays);
  if (situation) r = r.filter((p) => p.situation === situation);
  if (q) {
    const t = q.trim().toLowerCase();
    r = r.filter((p) =>
      [p.prenom, p.nom, p.statut, p.ville, PAYS[p.pays]?.nom, ...p.parcours.map((e) => e.titre + " " + e.detail)]
        .join(" ").toLowerCase().includes(t)
    );
  }
  return r;
}

export async function lireProfil(id) {
  return PROFILS.find((p) => p.id === id) ?? null;
}

export async function statsPubliques() {
  // Chiffres anonymes uniquement — seuls agrégats visibles sans connexion.
  return { anciens: 423, pays: 17, promotions: 9 };
}

export async function comptesParDomaine() {
  return { info: 84, sante: 67, inge: 112, maths: 45, eco: 38, agro: 21, enseignement: 18, autre: 12 };
}

export async function demandesEnAttente() {
  return DEMANDES;
}
