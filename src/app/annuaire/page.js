import { Suspense } from "react";
import TabBar from "@/components/TabBar";
import Annuaire from "./Annuaire";
import { listeMembres } from "@/lib/donnees";

export const metadata = { title: "Annuaire — LSNO Alumni" };

export default async function PageAnnuaire() {
  // NOTE Supabase : cette liste ne sera renvoyée qu'aux comptes validés (RLS).
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
