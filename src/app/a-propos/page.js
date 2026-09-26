import Link from "next/link";
import TabBar from "@/components/TabBar";
import Carrousel from "@/components/Carrousel3D";
import Compteur from "@/components/Compteur";
import { BlocInstallation } from "@/components/InstallerAppli";
import RetourDynamique from "@/components/RetourDynamique";
import { statsPubliques, utilisateurCourant, listeDelegues, listeConseils } from "@/lib/api";
import { nomDomaine } from "@/lib/donnees";

export const metadata = { title: "À propos — LSNO Amicale" };
export const dynamic = "force-dynamic";

// Fonds variés, comme sur l'accueil : photo du campus → feuille de papier
// (le manifeste) → chiffres sur bleu nuit → « comment ça marche » sur le sol
// kraft → délégués → photos → bloc d'installation replié → bande pierre
// pour les mentions.
export default async function APropos() {
  const [stats, moi] = await Promise.all([statsPubliques(), utilisateurCourant()]);
  const membre = moi?.statut_compte === "valide";
  const [delegues, conseils] = membre
    ? await Promise.all([listeDelegues(), listeConseils()])
    : [[], null];

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
          parcours des anciens pour que chaque cadet trouve le bon interlocuteur,
          sans que les conseils se perdent dans le flux des messages.
        </p>
        <p>
          Chaque membre choisit ce qu&apos;il partage. Aucune information n&apos;est
          visible en dehors des membres validés, et chaque inscription est
          confirmée par un délégué de promotion.
        </p>
        <p className="tagline" style={{ marginTop: 4 }}>Travail · Excellence · Discipline</p>
      </div>

      {/* le réseau en chiffres : mêmes chiffres publics que l'accueil */}
      <div className="a-stats ap-stats">
        <div className="a-stat"><b><Compteur valeur={stats.anciens} /></b><span>ancien{stats.anciens > 1 ? "s" : ""}</span></div>
        <div className="a-stat"><b><Compteur valeur={stats.pays} /></b><span>pays</span></div>
        <div className="a-stat"><b><Compteur valeur={stats.promotions} /></b><span>promotions</span></div>
        {conseils && conseils.length > 0 && (
          <div className="a-stat"><b><Compteur valeur={conseils.length} /></b><span>conseils</span></div>
        )}
      </div>

      <section className="ap-section">
        <h2 className="a-titre">Comment <em>ça marche</em></h2>
        <ol className="ap-pas">
          <li>
            <span className="num">1</span>
            <div><b>Tu t&apos;inscris</b><p>Prénom, nom, email, et la promotion dans laquelle tu es entré au LSNO. Deux minutes.</p></div>
          </li>
          <li>
            <span className="num">2</span>
            <div><b>Un délégué de ta promo te reconnaît</b><p>Il confirme que tu es bien des nôtres, en général sous 24 heures. Personne d&apos;extérieur ne passe.</p></div>
          </li>
          <li>
            <span className="num">3</span>
            <div><b>Le réseau s&apos;ouvre</b><p>L&apos;annuaire, les conseils des aînés, les offres partagées. Tu complètes ton profil, et les cadets te trouvent.</p></div>
          </li>
        </ol>
      </section>

      <section className="ap-section ap-delegues">
        <h2 className="a-titre">Qui fait <em>tourner le réseau</em></h2>
        {membre && delegues.length > 0 ? (
          <>
            <p className="a-sous">Les délégués reconnaissent leurs camarades et valident les inscriptions de leur promotion.</p>
            <div className="voisins">
              {delegues.map((m) => (
                <Link key={m.id} href={`/profil/${m.id}`} className="polaroid" draggable={false}>
                  {m.photo_url
                    ? <img className="polaroid-photo" src={m.photo_url} alt="" draggable={false} />
                    : <>
                        <span className="polaroid-photo polaroid-init">{(m.prenom[0] + (m.nom?.[0] ?? "")).toUpperCase()}</span>
                        <img className="polaroid-blason" src="/img/logo.jpg" alt="" draggable={false} />
                      </>}
                  <span className="polaroid-promo">P{m.promotions?.numero}</span>
                  <span className="polaroid-nom">
                    <b>{m.prenom}</b>
                    <small>Délégué · {nomDomaine(m.domaine, m.domaine_precision, true)}</small>
                  </span>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <p className="a-sous">
            Des anciens bénévoles : un ou deux délégués par promotion, qui reconnaissent leurs
            camarades et valident les inscriptions, et quelques administrateurs qui veillent sur
            l&apos;ensemble. {membre ? "Aucun délégué n'est nommé pour l'instant." : "Une fois membre, tu verras qui sont les délégués de chaque promotion."}
          </p>
        )}
      </section>

      <section className="ap-section ap-photos">
        <h2 className="a-titre">Le lycée, <em>en images</em></h2>
        <Carrousel legendes />
      </section>

      <div className="ap-installer">
        <BlocInstallation replie />
      </div>

      <section className="n-cloture apropos">
        <p className="lbl">Mentions</p>
        <p>
          LSNO Amicale (aussi appelée LSNO Alumni) est une plateforme associative à but non
          lucratif, éditée et administrée bénévolement par des anciens élèves du Lycée
          Scientifique National de Ouagadougou, indépendante de l&apos;administration du lycée.
        </p>
        <p>
          Hébergement : Vercel · données stockées chez Supabase. Chaque membre choisit la
          visibilité de ses informations, peut les rectifier à tout moment et supprimer
          définitivement son compte et ses données depuis « Mon profil ». Le site n&apos;utilise
          que des cookies de session, indispensables à la connexion, et aucun traceur publicitaire.
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
