import Link from "next/link";
import TabBar from "@/components/TabBar";
import Carrousel from "@/components/Carrousel3D";

export const metadata = { title: "À propos — LSNO Amicale" };

export default function APropos() {
  return (
    <main className="page avec-tabbar">
      <header className="f-tete tete-campus" style={{ paddingTop: 20, paddingBottom: 26 }}>
        <Link href="/" className="retour">← Accueil</Link>
        <h1>À propos<br />du <em>réseau</em></h1>
      </header>
      <div className="f-corps" style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--craie-2)" }}>
        <p>
          <b>LSNO Amicale</b>{" "}est le réseau des anciens du Lycée Scientifique National
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

        <Carrousel />

        <div style={{ borderTop: "1px solid var(--ligne)", paddingTop: 18, marginTop: 10, fontSize: 12.5, color: "var(--brume)", lineHeight: 1.65 }}>
          <p style={{ fontSize: 11, letterSpacing: ".25em", textTransform: "uppercase", color: "var(--or)", marginBottom: 8 }}>
            Mentions
          </p>
          <p>
            Plateforme associative à but non lucratif, éditée et administrée bénévolement par
            des anciens élèves du LSNO — indépendante de l&apos;administration du lycée.
            Contact : <a href="mailto:lsno.alumni@gmail.com" style={{ color: "var(--or-clair)", textDecoration: "underline" }}>lsno.alumni@gmail.com</a>.
          </p>
          <p style={{ marginTop: 8 }}>
            Hébergement : Vercel · données stockées chez Supabase.
            Chaque membre choisit la visibilité de ses informations, peut les rectifier à tout
            moment et supprimer définitivement son compte et ses données depuis « Mon profil ».
            Le site n&apos;utilise que des cookies de session, indispensables à la connexion —
            aucun traceur publicitaire.
          </p>
          <p style={{ marginTop: 8 }}>
            <Link href="/conditions" style={{ color: "var(--or-clair)", textDecoration: "underline" }}>
              Conditions d&apos;utilisation &amp; confidentialité
            </Link>
          </p>
        </div>
      </div>
      <TabBar actif="À propos" />
    </main>
  );
}
