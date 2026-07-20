import Link from "next/link";
import TabBar from "@/components/TabBar";
import Conseils from "./Conseils";
import { listeConseils } from "@/lib/api";

export const dynamic = "force-dynamic";
export const metadata = { title: "Conseils aux cadets — LSNO Amicale" };

export default async function PageConseils() {
  const conseils = await listeConseils();
  return (
    <main className="page avec-tabbar">
      <header className="n-tete tete-eleves" style={{ paddingBottom: 18 }}>
        <Link href="/" className="retour">← Accueil</Link>
        <h1 style={{ marginTop: 8 }}>Conseils<br />aux <em>cadets</em></h1>
        <p className="cpt">La sagesse des anciens, réunie par domaine.</p>
      </header>
      <Conseils conseils={conseils} />
      <TabBar />
    </main>
  );
}
