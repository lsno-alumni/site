import { redirect } from "next/navigation";
import TabBar from "@/components/TabBar";
import { utilisateurCourant } from "@/lib/api";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import Conversations from "./Conversations";

export const metadata = { title: "Messages — LSNO Amicale" };
export const dynamic = "force-dynamic";

// Brique 2 : conversations à deux et groupes, entre membres validés. Les
// messages s'effacent après 30 jours ; les groupes restent.
export default async function PageMessages() {
  const moi = await utilisateurCourant();
  if (!moi || moi.statut_compte !== "valide") redirect("/connexion");
  return (
    <main className="page avec-tabbar bu-messages">
      <Conversations moi={{ id: moi.id, prenom: moi.prenom, nom: moi.nom, photo: moi.photo_url, role: moi.role }} />
      {/* grand écran : la moitié droite, vide tant qu'aucune conversation n'est ouverte (caché sur mobile) */}
      <div className="bu bu-conv-vide">
        <div className="vide">
          <div className="gros" aria-hidden><MessageCircle size={34} strokeWidth={1.5} /></div>
          <b>Choisis une conversation</b>{" "}
          Ou écris à quelqu&apos;un : depuis son profil, ou avec la plume.
          <div style={{ marginTop: 18 }}><Link href="/messages/nouveau" className="btn btn-or">Nouvelle conversation</Link></div>
        </div>
      </div>
      <TabBar actif="Messages" />
    </main>
  );
}
