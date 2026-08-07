import TabBar from "@/components/TabBar";
import { SqueletteEnTeteListe, SqueletteFiche } from "@/components/Squelettes";

// Même trou que sur Offres/Mon profil : avant le montage du composant
// client, le serveur/middleware prend un instant — sans loading.js dédié,
// c'était le blason de la racine qui s'affichait à sa place.
export default function ChargementAdmin() {
  return (
    <main className="page avec-tabbar">
      <SqueletteEnTeteListe avecRecherche={false} />
      <div className="n-liste" style={{ paddingTop: 16 }}>
        {[0, 1].map((i) => <SqueletteFiche key={i} />)}
      </div>
      <TabBar actif="Validation" />
    </main>
  );
}
