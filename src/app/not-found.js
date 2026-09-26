import Link from "next/link";
import Sceau from "@/components/Sceau";

// Page introuvable : l'habillage du site (la page par défaut de Next était
// blanche, en anglais, sans thème), et deux sorties.
export const metadata = { title: "Page introuvable — LSNO Amicale" };

export default function Introuvable() {
  return (
    <main className="page page-sceau">
      <header className="f-tete tete-portail" style={{ paddingTop: 20 }}>
        <h1>Cette page<br />n&apos;existe <em>pas.</em></h1>
        <p>Le lien est peut-être ancien, ou mal recopié.</p>
      </header>
      <div className="succes">
        <div className="coche" aria-hidden style={{ fontFamily: "var(--font-titres), serif", fontWeight: 400, fontSize: 30 }}>404</div>
        <h2>Rien par ici</h2>
        <p>Le réseau, lui, est bien là.</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 18 }}>
          <Link href="/" className="btn btn-or" style={{ padding: "12px 22px" }}>Accueil</Link>
          <Link href="/annuaire" className="btn btn-nu" style={{ padding: "12px 22px" }}>Annuaire</Link>
        </div>
      </div>
      <Sceau />
    </main>
  );
}
