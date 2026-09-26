import Link from "next/link";
import TabBar from "@/components/TabBar";
import Carrousel from "@/components/Carrousel3D";
import { BlocInstallation } from "@/components/InstallerAppli";
import RetourDynamique from "@/components/RetourDynamique";

export const metadata = { title: "À propos — LSNO Amicale" };

// Fonds variés, comme sur l'accueil : photo du campus → feuille de papier
// (le manifeste) → photos sur le sol kraft → bloc d'installation → bande
// pierre pour les mentions.
export default function APropos() {
  return (
    <main className="page avec-tabbar">
      <header className="f-tete tete-campus" style={{ paddingTop: 20 }}>
        <RetourDynamique secours="/" libelle="Retour" />
        <h1>À propos<br />du <em>réseau</em></h1>
      </header>
      <div className="f-corps ap-manifeste">
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
        <p className="tagline" style={{ marginTop: 4 }}>Travail · Excellence · Discipline</p>
      </div>

      <section className="ap-photos">
        <h2 className="a-titre">Le lycée, <em>en images</em></h2>
        <Carrousel />
      </section>

      <div className="ap-installer">
        <BlocInstallation />
      </div>

      <section className="n-cloture apropos">
        <p className="lbl">Mentions</p>
        <p>
          LSNO Amicale (aussi appelée LSNO Alumni) est une plateforme associative à but non
          lucratif, éditée et administrée bénévolement par des anciens élèves du Lycée
          Scientifique National de Ouagadougou — indépendante de l&apos;administration du lycée.
        </p>
        <p>
          Hébergement : Vercel · données stockées chez Supabase. Chaque membre choisit la
          visibilité de ses informations, peut les rectifier à tout moment et supprimer
          définitivement son compte et ses données depuis « Mon profil ». Le site n&apos;utilise
          que des cookies de session, indispensables à la connexion — aucun traceur publicitaire.
        </p>
        <p className="ap-liens">
          <a href="mailto:lsno.alumni@gmail.com">lsno.alumni@gmail.com</a>
          <span aria-hidden>·</span>
          <Link href="/conditions">Conditions &amp; confidentialité</Link>
        </p>
      </section>
      <TabBar actif="À propos" />
    </main>
  );
}
