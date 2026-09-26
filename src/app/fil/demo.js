// DONNÉES DE DÉMONSTRATION de la maquette du Fil (branche `social`) — à
// remplacer par la vraie lecture en base une fois le design validé.
// Prénoms et situations inventés ; photos = celles du site.
export const MOI = { prenom: "Taobata", nom: "SIMPORE", photo: "/img/av3.jpg" };

export const FIL_DEMO = [
  {
    type: "publication", id: 1, il_y_a: "il y a 2 h",
    auteur: { id: "a1", prenom: "Aïcha", nom: "KABORÉ", promo: 2, photo: "/img/av2.jpg" },
    texte: "Diplômée ! Après cinq ans à Rabat, l'ENSA me remet mon diplôme d'ingénieure en génie civil ce matin. Merci à tous les aînés du réseau qui m'ont conseillée en première année, vous savez qui vous êtes.",
    photo: "/img/lsno_promo2.jpg",
    bravos: 24, commentaires: 7, jai_bravo: true,
  },
  {
    type: "arrivee", id: 2, il_y_a: "il y a 5 h",
    membre: { id: "a2", prenom: "Awa", nom: "OUÉDRAOGO", promo: 6, domaine: "Médecine", photo: "/img/av1.jpg", ville: "Ouagadougou" },
  },
  {
    type: "publication", id: 3, il_y_a: "hier",
    auteur: { id: "a3", prenom: "Moussa", nom: "TRAORÉ", promo: 1, photo: null },
    texte: "Question aux anciens en France : quelqu'un a fait la démarche de VAE pour un diplôme burkinabè ? Je cherche un retour d'expérience avant de me lancer.",
    photo: null,
    bravos: 3, commentaires: 12, jai_bravo: false,
  },
  {
    type: "offre", id: 4, il_y_a: "hier",
    offre: { id: 19, type: "stage", titre: "Stage Data & AI JPMorganChase", domaine: "Informatique", lieu: "London, Royaume-Uni", date_limite: "2026-11-01", posteur: "Jamil Claude MAIGA" },
  },
  {
    type: "publication", id: 5, il_y_a: "avant-hier",
    auteur: { id: "a4", prenom: "Fatimata", nom: "SAWADOGO", promo: 3, photo: "/img/av4.jpg" },
    texte: "Retrouvailles de la promo 3 à Ouaga samedi. Douze ans après le concours d'entrée, on se reconnaît encore.",
    photo: "/img/lsno_promo3.jpg",
    bravos: 41, commentaires: 15, jai_bravo: false,
  },
  {
    type: "conseil", id: 6, il_y_a: "cette semaine",
    conseil: { id: "a5", prenom: "Ibrahim", nom: "ZONGO", promo: 2, photo: "/img/av5.jpg", theme: "Orientation post-bac",
      texte: "Ne choisis pas une filière parce qu'un aîné y a réussi. Demande-lui plutôt ce qu'il ferait différemment s'il avait ton âge aujourd'hui." },
  },
  {
    type: "publication", id: 7, il_y_a: "il y a 3 j",
    auteur: { id: "a6", prenom: "Rasmata", nom: "NIKIÉMA", promo: 4, photo: null },
    texte: "Je passe l'agrégation de maths en juin. Si des anciens sont passés par là, un mot d'encouragement ou un conseil de méthode me ferait du bien.",
    photo: null,
    bravos: 18, commentaires: 9, jai_bravo: true,
  },
  {
    type: "arrivee", id: 8, il_y_a: "il y a 4 j",
    membre: { id: "a7", prenom: "Yacouba", nom: "DIALLO", promo: 1, domaine: "Aéronautique", photo: null, ville: "Toulouse" },
  },
];
