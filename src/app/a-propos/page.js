import Link from "next/link";
import TabBar from "@/components/TabBar";

export const metadata = { title: "À propos — LSNO Alumni" };

export default function APropos() {
  return (
    <main className="page avec-tabbar">
      <header className="f-tete tete-campus" style={{ paddingTop: 20, paddingBottom: 26 }}>
        <Link href="/" className="retour">← Accueil</Link>
        <h1>À propos<br />du <em>réseau</em></h1>
      </header>
      <div className="f-corps" style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--craie-2)" }}>
        <p>
          <b>LSNO Alumni</b>{" "}est le réseau des anciens du Lycée Scientifique National
          de Ouagadougou. Né d&apos;une discussion entre promotions, il centralise les
          parcours des anciens pour que chaque cadet trouve le bon interlocuteur —
          sans que les conseils se perdent dans le flux des messages.
        </p>
        <p>
          Chaque membre choisit ce qu&apos;il partage. Aucune information n&apos;est
          visible en dehors des membres validés, et chaque inscription est
          confirmée par un délégué de promotion.
        </p>
        <p className="tagline" style={{ marginTop: 10 }}>Travail · Excellence · Discipline</p>
      </div>
      <TabBar actif="À propos" />
    </main>
  );
}
