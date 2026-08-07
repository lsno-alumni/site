import { Suspense } from "react";
import Link from "next/link";
import { Hourglass, Info } from "lucide-react";
import TabBar from "@/components/TabBar";
import Annuaire from "./Annuaire";
import { listeMembres, utilisateurCourant } from "@/lib/api";

export const metadata = { title: "Annuaire — LSNO Amicale" };

export default async function PageAnnuaire() {
  const moi = await utilisateurCourant();

  // Compte pas encore validé : expliquer pourquoi l'annuaire est fermé, plutôt
  // que d'afficher une liste vide incompréhensible. Et surtout : ne pas faire
  // attendre une réponse DÉJÀ DONNÉE (migration 37 — refuse_le).
  if (moi && moi.statut_compte !== "valide") {
    const refuse = Boolean(moi.refuse_le);
    return (
      <main className="page avec-tabbar">
        <header className="n-tete" style={{ paddingBottom: 20 }}>
          <h1>Les anciens</h1>
        </header>
        <div className="vide" style={{ paddingTop: 60 }}>
          <div className="gros" aria-hidden>
            {refuse ? <Info size={30} strokeWidth={1.6} /> : <Hourglass size={30} strokeWidth={1.6} />}
          </div>
          {refuse ? (
            <>
              <b>Ta demande n&apos;a pas été retenue</b>{" "}
              Un délégué de ta promotion a examiné ton inscription et ne l&apos;a pas
              validée. L&apos;annuaire reste donc fermé.<br />
              Si tu penses qu&apos;il s&apos;agit d&apos;une erreur — homonyme, promotion
              mal choisie — écris aux responsables du réseau, la marche à suivre est
              sur la page « À propos ».
              <div style={{ marginTop: 20 }}>
                <Link href="/a-propos" className="btn btn-nu">Nous contacter</Link>
              </div>
            </>
          ) : (
            <>
              <b>Ton délégué examine ta demande</b>{" "}
              L&apos;annuaire s&apos;ouvrira dès qu&apos;un délégué de ta promotion aura
              confirmé ton inscription — en général sous 24 h.<br />
              Tu recevras un email à ce moment-là.
              <div style={{ marginTop: 20 }}>
                <Link href="/mon-profil" className="btn btn-or">
                  Compléter mon profil en attendant
                </Link>
              </div>
            </>
          )}
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
