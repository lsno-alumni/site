// La feuille glissante (aperçu de profil) est un slot parallèle @modal,
// affiché PAR-DESSUS le contenu normal de l'annuaire — jamais à sa place.
// Voir src/app/annuaire/@modal/(.)profil/[id]/ (route interceptée).
export default function LayoutAnnuaire({ children, modal }) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
