// La feuille glissante (aperçu de l'auteur d'un conseil) est un slot
// parallèle @modal, affiché PAR-DESSUS la liste des conseils — la lecture
// en cours n'est jamais quittée. Voir @modal/(..)profil/[id]/.
export default function LayoutConseils({ children, modal }) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
