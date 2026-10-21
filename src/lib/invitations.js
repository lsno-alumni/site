// Les invitations qu'on peut écarter (« Active tes notifs », « Installe l'appli »),
// mémorisées sur l'appareil. Décision du 21/10 : « plus tard » veut dire plus tard —
// l'invitation revient après 30 jours, trois fois au plus, puis silence.
// Compatibilité : l'ancienne valeur « 1 » (écartée une fois, date inconnue) compte
// pour une fois, à une date lointaine → elle revient une fois de plus.
export const RETOUR_JOURS = 30;
export const MAX_FOIS = 3;

function lire(cle) {
  try {
    const v = localStorage.getItem(cle);
    if (!v) return null;
    if (v === "1") return { n: 1, le: 0 };
    const j = JSON.parse(v);
    return typeof j?.n === "number" ? j : { n: 1, le: 0 };
  } catch { return null; }
}

// faut-il la cacher en ce moment ?
export function ecartee(cle) {
  const e = lire(cle);
  if (!e) return false;
  if (e.n >= MAX_FOIS) return true;
  return Date.now() - e.le < RETOUR_JOURS * 86400000;
}

// « plus tard » : une fois de plus, datée
export function ecarter(cle) {
  const e = lire(cle) ?? { n: 0, le: 0 };
  try { localStorage.setItem(cle, JSON.stringify({ n: e.n + 1, le: Date.now() })); } catch { /* stockage indisponible */ }
}

// repère d'un geste qui appelle une réponse (question posée…), lu une fois sur l'écran suivant
const CLE_CONTEXTE = "lsno-invite-contexte";
export function marquerContexte(valeur) { try { sessionStorage.setItem(CLE_CONTEXTE, valeur); } catch { /* rien */ } }
export function consommerContexte(valeur) {
  try {
    if (sessionStorage.getItem(CLE_CONTEXTE) !== valeur) return false;
    sessionStorage.removeItem(CLE_CONTEXTE);
    return true;
  } catch { return false; }
}
