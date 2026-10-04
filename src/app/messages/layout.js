// La création d'une conversation est un slot parallèle @modal, affiché
// PAR-DESSUS la liste des messages (feuille glissante). Voir @modal/(.)nouveau/.
export default function LayoutMessages({ children, modal }) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
