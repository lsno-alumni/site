import TabBar from "@/components/TabBar";
import { SqueletteEnTeteListe, SqueletteOffre } from "@/components/Squelettes";

// Avant même que le composant client Offres.js ne se monte, le serveur (et
// son middleware) prend un instant — Next.js affiche alors le loading.js le
// plus proche pendant cette attente. Sans celui-ci, c'était celui de la
// racine (le blason plein écran) qui apparaissait à sa place.
export default function ChargementOffres() {
  return (
    <main className="page avec-tabbar">
      <SqueletteEnTeteListe avecRecherche={false} />
      <div className="n-liste" style={{ paddingTop: 16 }}>
        {[0, 1, 2].map((i) => <SqueletteOffre key={i} />)}
      </div>
      <TabBar actif="Offres" />
    </main>
  );
}
