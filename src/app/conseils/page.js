import TabBar from "@/components/TabBar";
import Conseils from "./Conseils";
import RetourDynamique from "@/components/RetourDynamique";
import { listeConseils } from "@/lib/api";

export const dynamic = "force-dynamic";
export const metadata = { title: "Conseils aux cadets — LSNO Amicale" };

export default async function PageConseils() {
  const conseils = await listeConseils();
  return (
    <main className="page avec-tabbar">
      <header className="n-tete tete-promo1" style={{ paddingBottom: 18 }}>
        <RetourDynamique secours="/" libelle="Retour" />
        <h1 style={{ marginTop: 8 }}>Conseils<br />aux <em>cadets</em></h1>
        <p className="cpt">La sagesse des anciens, réunie par thème.</p>
      </header>
      <Conseils conseils={conseils} />
      <TabBar />
    </main>
  );
}
