"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import * as memoire from "@/lib/memoire";
import { chargerRail } from "@/lib/moments";

// Sur l'accueil connecté : les derniers moments en quelques ronds, et un
// lien vers le Fil. Rien si personne n'a de moment en cours.
export default function ApercuMoments({ moiId }) {
  const [rail, setRail] = useState(() => memoire.lire("fil.rail") ?? null);
  useEffect(() => {
    let vivant = true;
    const t = setTimeout(() => chargerRail().then((r) => { if (vivant) setRail(r); }).catch(() => {}), 0);
    return () => { vivant = false; clearTimeout(t); };
  }, []);
  const autres = (rail ?? []).filter((a) => a.auteur.id !== moiId).slice(0, 4);
  if (!autres.length) return null;
  const nouveaux = autres.filter((a) => !a.tout_vu).length;
  return (
    <section className="a-section">
      <h2 className="a-titre" style={{ marginBottom: 6 }}>Moments</h2>
      <p className="am-sous-titre">{nouveaux ? `${nouveaux} ${nouveaux > 1 ? "personnes ont" : "personne a"} partagé quelque chose que tu n’as pas encore vu.` : "Des instants partagés, qui s’effacent d’eux-mêmes."}</p>
      <div className="rail am-rail" role="list" aria-label="Moments">
        {autres.map((a) => {
          const premier = a.moments.find((m) => !m.vu) ?? a.moments[0];
          return (
            <Link key={a.auteur.id} href={`/fil?moment=${premier.id}`} className="rail-item" role="listitem">
              <span className={`rail-cercle${a.tout_vu ? " vu" : " nouveau"}`}>
                {a.auteur.photo_url ? <img src={a.auteur.photo_url} alt="" /> : <span className="rail-init">{(a.auteur.prenom[0] + (a.auteur.nom?.[0] || "")).toUpperCase()}</span>}
              </span>
              <span className="rail-nom">{a.auteur.prenom}</span>
            </Link>
          );
        })}
        <Link href="/fil" className="rail-item am-rail-tout" role="listitem">
          <span className="rail-cercle am-rail-fleche"><ArrowRight size={20} aria-hidden /></span>
          <span className="rail-nom">Le Fil</span>
        </Link>
      </div>
    </section>
  );
}
