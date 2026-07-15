import { Suspense } from "react";
import TabBar from "@/components/TabBar";
import Offres from "./Offres";

export const metadata = { title: "Offres — LSNO Amicale" };
export const dynamic = "force-dynamic";

export default function PageOffres() {
  return (
    <main className="page avec-tabbar">
      <Suspense>
        <Offres />
      </Suspense>
      <TabBar actif="Offres" />
    </main>
  );
}
