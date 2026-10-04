// La feuille glissante (un événement) est un slot parallèle @modal, affiché
// PAR-DESSUS la liste — on retrouve la liste telle qu'elle était en la
// fermant. Voir @modal/(..)evenements/[id]/.
export default function LayoutEvenements({ children, modal }) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
