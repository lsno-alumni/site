// Remonté à chaque navigation (contrairement à layout.js) : porte le fondu
// d'entrée des pages, pour qu'aucun écran n'apparaisse d'un coup. La barre
// d'onglets, elle, ne clignote pas (exclue par le CSS).
export default function Template({ children }) {
  return <div className="entree-page">{children}</div>;
}
