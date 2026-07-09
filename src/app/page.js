import Link from "next/link";
import Reveal from "@/components/Reveal";
import Compteur from "@/components/Compteur";
import Poussiere from "@/components/Poussiere";
import MenuPublic from "@/components/MenuPublic";
import { DOMAINES, PAYS } from "@/lib/donnees";
import { statsPubliques } from "@/lib/api";

// Accueil PUBLIC : aucune donnée personnelle — uniquement des agrégats anonymes
// (exigence du cahier des charges ; le carrousel « nouveaux membres » vit sur
// l'accueil connecté, pas ici).
export default async function Accueil() {
  const stats = await statsPubliques();
  const parDomaine = stats.parDomaine;

  return (
    <main className="page">
      <header className="a-hero">
        <Poussiere />
        <div className="a-nav">
          <div className="a-marque">
            <img className="sceau" src="/img/logo.jpg" alt="Blason du LSNO" /> LSNO Alumni
          </div>
          <MenuPublic />
        </div>
        <p className="tagline">
          {stats.anciens} ancien{stats.anciens > 1 ? "s" : ""} · {stats.pays} pays
        </p>
        <h1>Tes aînés sont<br />déjà <em>passés par là.</em></h1>
        <p className="pitch">
          Retrouve les anciens du Lycée Scientifique National, par domaine, promotion ou pays.
        </p>
        <div className="a-cta">
          <Link href="/inscription" className="btn btn-or">Rejoindre le réseau</Link>
          <Link href="/connexion" className="btn btn-nu">Se connecter</Link>
        </div>
        <div className="a-stats">
          <div className="a-stat"><b><Compteur valeur={stats.anciens} /></b><span>ancien{stats.anciens > 1 ? "s" : ""}</span></div>
          <div className="a-stat"><b><Compteur valeur={stats.pays} /></b><span>pays</span></div>
          <div className="a-stat"><b><Compteur valeur={stats.promotions} /></b><span>promotions</span></div>
        </div>
      </header>

      <Reveal>
      <section className="a-section">
        <h2 className="a-titre">Qui fait quoi ?</h2>
        <p className="a-sous">Choisis un domaine, découvre qui contacter.</p>
        <div className="doms">
          {DOMAINES.filter((d) => d.cle !== "autre").map((d) => (
            <Link key={d.cle} href={`/annuaire?domaine=${d.cle}`} className="dom">
              <span className="pictol" aria-hidden>{d.icone}</span>
              <span className="txt"><b>{d.nom}</b><span>{d.detail}</span></span>
              <span className="nb"><Compteur valeur={parDomaine[d.cle] ?? 0} /></span>
              <span className="fl" aria-hidden>→</span>
            </Link>
          ))}
        </div>
      </section>
      </Reveal>

      <Reveal>
      <section className="a-monde">
        <p className="tagline">Le réseau dans le monde</p>
        <h4 className="serif">
          {stats.pays > 1
            ? `${stats.pays} pays et ça continue`
            : "Un réseau qui s'étend"}
        </h4>
        <p>
          {stats.pays > 1
            ? "Où que tu veuilles aller, un ancien y est peut-être déjà."
            : "Du Burkina vers le monde : chaque nouvel inscrit étend la carte."}
        </p>
        <div className="a-pays">
          <span><img className="drapo" src={PAYS.BF.drapeau} alt="" /> Burkina Faso</span>
          <span><img className="drapo" src={PAYS.MA.drapeau} alt="" /> Maroc</span>
          <span><img className="drapo" src={PAYS.FR.drapeau} alt="" /> France</span>
          <span><img className="drapo" src={PAYS.CA.drapeau} alt="" /> Canada</span>
          <span><img className="drapo" src={PAYS.SN.drapeau} alt="" /> Sénégal</span>
          <span>et ailleurs…</span>
        </div>
      </section>
      </Reveal>

      <Reveal>
      <section className="a-temoin">
        <p>
          Un ancien m&apos;a orientée vers la bourse qui a changé ma vie.
          C&apos;est exactement pour ça que ce réseau existe.
        </p>
        <div className="qui">
          <div><b>Une ancienne de la promotion 4</b><span>Génie civil, Rabat</span></div>
        </div>
      </section>
      </Reveal>

      <footer className="pied-public">
        <img className="ecusson" src="/img/logo.jpg" alt="" />
        <p className="tagline" style={{ color: "var(--or)" }}>Travail · Excellence · Discipline</p>
        <p style={{ marginTop: 8 }}>
          Lycée Scientifique National de Ouagadougou<br />
          Ouagadougou, Burkina Faso · Série C · Promotions 2017 → aujourd&apos;hui
        </p>
      </footer>
    </main>
  );
}
