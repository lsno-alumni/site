"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, PlayCircle } from "lucide-react";
import RetourDynamique from "@/components/RetourDynamique";
import TourNouveautes from "@/components/TourNouveautes";
import { GESTES, cartesPour, useTourEtat } from "@/lib/tour";

// La page « Nouveautés » : les cartes du tour en version lisible, les gestes
// à connaître, et « Refaire le tour ».
export default function Nouveautes() {
  const [tour, setTour] = useState(false);
  const etat = useTourEtat();
  const cartes = cartesPour(etat?.role);   // la carte « Ta promo » n'apparaît qu'aux délégués et admins
  return (
    <>
      <header className="n-tete tete-nouveautes">
        <RetourDynamique secours="/a-propos" />
        <h1>Les <em>nouveautés</em></h1>
        <p className="cpt">Le réseau s’ouvre : voici ce que tu peux faire maintenant, et comment.</p>
      </header>
      <div className="nv-corps">
        <button type="button" className="btn btn-or nv-refaire" onClick={() => setTour(true)}><PlayCircle size={18} aria-hidden /> Refaire le tour</button>
        {cartes.map((c, i) => (
          <article key={c.cle} className="nv-carte" id={`nv-${c.cle}`}>
            <span className="nv-num">{i + 1}</span>
            <div className="nv-texte">
              <h2>{c.titre}</h2>
              <p className="nv-accroche">{c.accroche}</p>
              <ul>{c.points.map((p) => <li key={p}><Check size={14} aria-hidden /> {p}</li>)}</ul>
              <Link href={c.lien} className="nv-lien">Y aller <ArrowRight size={14} aria-hidden /></Link>
            </div>
            <div className="nv-cadre"><img src={c.image} alt="" loading="lazy" onError={(e) => { e.currentTarget.parentElement.style.display = "none"; }} /></div>
          </article>
        ))}
        <section className="nv-gestes">
          <h2>Les gestes à connaître</h2>
          <dl>
            {GESTES.map((g) => <div key={g.titre}><dt>{g.titre}</dt><dd>{g.texte}</dd></div>)}
          </dl>
        </section>
      </div>
      {tour && <TourNouveautes cartes={cartes} onFermer={() => setTour(false)} />}
    </>
  );
}
