// La feuille glissante (une publication et ses commentaires) est un slot
// parallèle @modal, affiché PAR-DESSUS le Fil — on retrouve le fil tel qu'il
// était en la fermant. Voir @modal/(..)publication/[id]/.
export default function LayoutFil({ children, modal }) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
