// Splash racine : envoyé en streaming dès les premiers octets, pendant que
// le serveur termine ses requêtes — remplace la page blanche du premier
// chargement (couvre toute page sans squelette dédié).
export default function ChargementRacine() {
  return (
    <main className="splash">
      <img className="splash-blason" src="/img/logo.jpg" alt="" />
      <p className="splash-nom">LSNO <em>Amicale</em></p>
      <span className="splash-trait" aria-hidden />
    </main>
  );
}
