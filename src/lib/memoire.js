// Mémoire d'onglet pour les pages qui chargent leurs données DANS le navigateur
// (offres, Mon profil, Validation). Un simple registre au niveau du module :
// il survit aux navigations côté client (Next ne recharge pas les modules) et
// repart de zéro à un vrai rechargement ou à la fermeture de l'onglet — jamais
// écrit côté serveur, donc aucune fuite entre utilisateurs, aucun décalage
// d'hydratation (au premier chargement il est vide des deux côtés).
//
// Usage : `useState(() => lire("offres"))` pour afficher tout de suite ce
// qu'on avait, puis `charger()` en arrière-plan comme avant, et un effet qui
// recopie l'état dans le registre à chaque changement (`ecrire`). C'est le
// même principe que `roleCache` dans TabBar.js, qui avait supprimé le
// clignotement des onglets. Réglé le 26/09 (« l'affaire du cache »).
const registre = new Map();

export function lire(cle) {
  return registre.has(cle) ? registre.get(cle) : undefined;
}

export function ecrire(cle, valeur) {
  if (valeur === undefined) return;
  registre.set(cle, valeur);
}

// à la déconnexion : rien de l'ancien membre ne doit rester en mémoire
export function toutOublier() {
  registre.clear();
}
