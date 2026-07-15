import Link from "next/link";
import Reveal from "@/components/Reveal";
import Compteur from "@/components/Compteur";
import Poussiere from "@/components/Poussiere";
import MenuPublic from "@/components/MenuPublic";
import IconeDomaine from "@/components/IconeDomaine";
import { DOMAINES, PAYS, LISTE_PAYS, nomPays } from "@/lib/donnees";
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
            <img className="sceau" src="/img/logo.jpg" alt="Blason du LSNO" /> LSNO Amicale
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
              <span className="pictol"><IconeDomaine domaine={d.cle} /></span>
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
        {(() => {
          const entrees = Object.entries(stats.parPays).sort((a, b) => b[1] - a[1]);
          const max = entrees[0]?.[1] ?? 1;
          return (
            <div className="pays-barres">
              {entrees.map(([code, n]) => (
                <div className="pays-barre" key={code}>
                  <span className="pays-nom">
                    {PAYS[code] && <img className="drapo" src={PAYS[code].drapeau} alt="" />} {nomPays(code)}
                  </span>
                  <span className="pays-jauge">
                    <i style={{ width: `${(n / max) * 100}%` }} />
                  </span>
                  <b>{n}</b>
                </div>
              ))}
            </div>
          );
        })()}
      </section>
      </Reveal>

      <Reveal>
      <section className="a-section">
        <h2 className="a-titre">Les promotions</h2>
        <p className="a-sous">Quelle promo répondra le plus présent ?</p>
        <div className="promo-histo">
          {Array.from({ length: stats.promotions }, (_, i) => i + 1).map((num) => {
            const n = stats.parPromo[num] ?? 0;
            const max = Math.max(1, ...Object.values(stats.parPromo));
            return (
              <div className="promo-col" key={num}>
                <b>{n || ""}</b>
                <div className={`promo-jauge${n === max && n > 0 ? " tete" : ""}`}
                  style={{ height: `${Math.max(4, (n / max) * 72)}px` }} />
                <span>P{num}</span>
              </div>
            );
          })}
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
