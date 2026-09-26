// La feuille glissante (aperçu d'une offre) est un slot parallèle @modal,
// affiché PAR-DESSUS la liste — jamais à sa place.
// Voir src/app/offres/@modal/(..)offres/[id]/ (route interceptée).
export default function LayoutOffres({ children, modal }) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
