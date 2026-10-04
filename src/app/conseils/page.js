import TabBar from "@/components/TabBar";
import Conseils from "./Conseils";
import RetourDynamique from "@/components/RetourDynamique";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { listeConseils, utilisateurCourant } from "@/lib/api";

export const dynamic = "force-dynamic";
export const metadata = { title: "Conseils aux cadets — LSNO Amicale" };

export default async function PageConseils() {
  const [conseils, moi] = await Promise.all([listeConseils(), utilisateurCourant()]);
  return (
    <main className="page avec-tabbar">
      <header className="n-tete tete-promo1" style={{ paddingBottom: 18 }}>
        <RetourDynamique secours="/" libelle="Retour" />
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <h1 style={{ marginTop: 8 }}>Conseils<br />aux <em>cadets</em></h1>
          {moi?.statut_compte === "valide" && (
            <Link href="/bibliotheque" className="n-vers-conseils" style={{ marginTop: 12 }}>
              <BookOpen size={14} strokeWidth={1.9} aria-hidden /> Annales
            </Link>
          )}
        </div>
        <p className="cpt">La sagesse des anciens, réunie par thème.</p>
      </header>
      <Conseils conseils={conseils} moiId={moi?.id ?? null} />
      <TabBar />
    </main>
  );
}
