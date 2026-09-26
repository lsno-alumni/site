// Le sceau en pied de page : le blason du lycée, petit et discret, avec la
// devise — comme un tampon en bas d'une lettre. Pour les pages SANS barre de
// navigation qui finissaient sur du papier vide (connexion, inscription, mot
// de passe, bienvenue, 404…). La page le pousse tout en bas quand elle est
// courte (.page-sceau), il suit le contenu quand elle est longue.
export default function Sceau() {
  return (
    <footer className="pied-sceau" aria-label="LSNO Amicale">
      <img src="/img/logo.jpg" alt="" width={44} height={44} />
      <span>LSNO Amicale</span>
      <small>Travail · Excellence · Discipline</small>
    </footer>
  );
}
