import TabBar from "@/components/TabBar";
import { SqueletteProfil } from "@/components/Squelettes";

export default function ChargementProfil() {
  return (
    <main className="page avec-tabbar">
      <SqueletteProfil />
      <TabBar actif="Annuaire" />
    </main>
  );
}
