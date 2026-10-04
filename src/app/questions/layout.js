// La feuille glissante (une question et ses réponses) est un slot parallèle
// @modal, affiché PAR-DESSUS la liste — on retrouve la liste telle qu'elle
// était en la fermant. Voir @modal/(..)questions/[id]/.
export default function LayoutQuestions({ children, modal }) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
