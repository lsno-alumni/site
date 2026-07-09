import { Suspense } from "react";
import TabBar from "@/components/TabBar";
import Annuaire from "./Annuaire";
import { listeMembres } from "@/lib/api";

export const metadata = { title: "Annuaire — LSNO Alumni" };
export const dynamic = "force-dynamic";

export default async function PageAnnuaire() {
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
