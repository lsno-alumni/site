import TabBar from "@/components/TabBar";
import { SqueletteFiche } from "@/components/Squelettes";

// Même trou que sur Offres/Mon profil/Validation avant eux : sans loading.js
// dédié, c'est le blason de la racine qui s'affichait à sa place.
export default function ChargementConseils() {
  return (
    <main className="page avec-tabbar">
      <header className="n-tete tete-promo1" style={{ paddingBottom: 18 }}>
        <h1 style={{ marginTop: 8 }}>Conseils<br />aux <em>cadets</em></h1>
        <p className="cpt">La sagesse des anciens, réunie par thème.</p>
      </header>
      <div className="n-liste" style={{ paddingTop: 16 }}>
        {[0, 1, 2].map((i) => <SqueletteFiche key={i} />)}
      </div>
      <TabBar />
    </main>
  );
}
