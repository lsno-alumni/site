import TabBar from "@/components/TabBar";
import { SqueletteEnTeteListe, SqueletteFormulaire } from "@/components/Squelettes";

// Même trou que sur Offres : avant le montage du composant client, le
// serveur/middleware prend un instant — sans loading.js dédié, c'était le
// blason de la racine qui s'affichait à sa place.
export default function ChargementMonProfil() {
  return (
    <main className="page avec-tabbar">
      <SqueletteEnTeteListe avecRecherche={false} />
      <SqueletteFormulaire />
      <TabBar actif="Mon profil" />
    </main>
  );
}
