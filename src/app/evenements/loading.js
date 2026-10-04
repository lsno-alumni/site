import TabBar from "@/components/TabBar";
import { SqueletteEnTeteListe, SqueletteOffre } from "@/components/Squelettes";

export default function Chargement() {
  return (
    <main className="page avec-tabbar">
      <SqueletteEnTeteListe avecRecherche={false} />
      <div className="n-liste" style={{ paddingTop: 16 }}>
        {[0, 1, 2].map((i) => <SqueletteOffre key={i} />)}
      </div>
      <TabBar actif="Fil" />
    </main>
  );
}
