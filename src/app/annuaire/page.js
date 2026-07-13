import { Suspense } from "react";
import Link from "next/link";
import { Hourglass } from "lucide-react";
import TabBar from "@/components/TabBar";
import Annuaire from "./Annuaire";
import { listeMembres, utilisateurCourant } from "@/lib/api";

export const metadata = { title: "Annuaire — LSNO Amicale" };
export const dynamic = "force-dynamic";

export default async function PageAnnuaire() {
  const moi = await utilisateurCourant();

  // Compte pas encore validé : expliquer pourquoi l'annuaire est fermé,
  // plutôt que d'afficher une liste vide incompréhensible.
  if (moi && moi.statut_compte !== "valide") {
    return (
      <main className="page avec-tabbar">
        <header className="n-tete" style={{ paddingBottom: 20 }}>
          <h1>Les anciens</h1>
        </header>
        <div className="vide" style={{ paddingTop: 60 }}>
          <div className="gros" aria-hidden><Hourglass size={30} strokeWidth={1.6} /></div>
          <b>Ton délégué examine ta demande</b>
          L&apos;annuaire s&apos;ouvrira dès qu&apos;un délégué de ta promotion aura
          confirmé ton inscription — en général sous 24 h.<br />
          Tu recevras un email à ce moment-là.
          <div style={{ marginTop: 20 }}>
            <Link href="/mon-profil" className="btn btn-or">
              Compléter mon profil en attendant
            </Link>
          </div>
        </div>
        <TabBar actif="Annuaire" />
      </main>
    );
  }

  // La RLS ne renvoie cette liste qu'aux comptes validés.
  const membres = await listeMembres();
  return (
    <main className="page avec-tabbar">
      <Suspense>
        <Annuaire membres={membres} />
      </Suspense>
      <TabBar actif="Annuaire" />
    </main>
  );
}
