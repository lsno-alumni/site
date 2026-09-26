import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";
import TabBar from "@/components/TabBar";
import { utilisateurCourant } from "@/lib/api";

export const metadata = { title: "Messages — LSNO Amicale" };
export const dynamic = "force-dynamic";

// Emplacement de la brique 2 (conversations et groupes) — en attendant, la
// page dit ce qui arrive, dans l'habillage du site.
export default async function PageMessages() {
  const moi = await utilisateurCourant();
  if (!moi || moi.statut_compte !== "valide") redirect("/connexion");
  return (
    <main className="page avec-tabbar">
      <header className="n-tete tete-portail" style={{ paddingBottom: 26 }}>
        <h1>Messages</h1>
        <p className="cpt">Conversations et groupes, entre membres.</p>
      </header>
      <div className="vide" style={{ paddingTop: 60 }}>
        <div className="gros" aria-hidden><MessageCircle size={30} strokeWidth={1.6} /></div>
        <b>Bientôt</b>{" "}
        Les conversations arrivent avec la prochaine brique du chantier.
      </div>
      <TabBar actif="Messages" />
    </main>
  );
}
