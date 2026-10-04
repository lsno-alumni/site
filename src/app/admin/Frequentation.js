"use client";

import { useEffect, useState } from "react";
import { lireFrequentation } from "@/lib/visites";
import { texteErreur } from "@/lib/erreurs";

// Fréquentation, pour les admins (migration 85) : trois chiffres (actifs du jour,
// de la semaine, du mois), la courbe des 30 derniers jours, et la part des
// profils complets. Une seule série, notre bleu ; les chiffres en encre ; une
// table repliée pour qui préfère lire les valeurs.
const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const court = (iso) => { const d = new Date(iso + "T00:00:00"); return `${JOURS[d.getDay()]} ${d.getDate()}`; };
const long = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

export default function Frequentation() {
  const [f, setF] = useState(null);
  const [souci, setSouci] = useState("");
  useEffect(() => { lireFrequentation().then(setF).catch((e) => setSouci(texteErreur(e))); }, []);

  if (souci) return <p className="pu-vide">{souci}</p>;
  if (!f) return <p style={{ color: "var(--brume)", fontSize: 14 }}>Chargement…</p>;

  const courbe = f.courbe ?? [];
  const max = Math.max(1, ...courbe.map((c) => c.actifs));
  const pct = f.valides ? Math.round((100 * f.complets) / f.valides) : 0;
  const W = 600, H = 150, haut = 14, bas = 26, gauche = 6, droite = 6;
  const zone = H - haut - bas;
  const pas = (W - gauche - droite) / courbe.length;
  const larg = Math.max(4, pas - 3);
  const y = (v) => haut + zone - (v / max) * zone;
  const iMax = courbe.reduce((m, c, i) => (c.actifs > courbe[m].actifs ? i : m), 0);
  const dernier = courbe.length - 1;
  const repere = Math.max(1, Math.round(max / 2));

  return (
    <div className="fq">
      <p className="fq-intro">Membres distincts qui ont ouvert le réseau. Une visite par membre et par jour, rien d’autre n’est mesuré.</p>
      <div className="fq-tuiles">
        <div className="fq-tuile"><b>{f.jour}</b><span>aujourd’hui</span></div>
        <div className="fq-tuile"><b>{f.semaine}</b><span>7 derniers jours</span></div>
        <div className="fq-tuile"><b>{f.mois}</b><span>30 derniers jours</span></div>
      </div>

      <figure className="fq-figure">
        <figcaption>Actifs par jour, 30 derniers jours</figcaption>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Actifs par jour sur 30 jours, maximum ${max}`} className="fq-svg">
          {/* repères recessifs : le milieu et le maximum */}
          {[repere, max].filter((v, i, a) => a.indexOf(v) === i).map((v) => (
            <line key={v} x1={gauche} x2={W - droite} y1={y(v)} y2={y(v)} className="fq-grille" />   /* repères muets : les valeurs sont écrites sur le maximum et le dernier jour */
          ))}
          <line x1={gauche} x2={W - droite} y1={y(0)} y2={y(0)} className="fq-base" />
          {courbe.map((c, i) => {
            const x = gauche + i * pas + (pas - larg) / 2;
            const h = Math.max(c.actifs ? 3 : 0, (c.actifs / max) * zone);
            return (
              <g key={c.jour} className="fq-barre">
                <title>{`${long(c.jour)} : ${c.actifs} actif${c.actifs > 1 ? "s" : ""}`}</title>
                <rect x={x - 1.5} y={haut} width={larg + 3} height={zone} fill="transparent" />
                {c.actifs > 0 && <rect x={x} y={y(0) - h} width={larg} height={h} rx={2} />}
                {(i === iMax || i === dernier) && c.actifs > 0 && (
                  <text x={x + larg / 2} y={y(0) - h - 4} textAnchor="middle" className="fq-valeur">{c.actifs}</text>
                )}
              </g>
            );
          })}
          <text x={gauche} y={H - 8} className="fq-axe">{court(courbe[0]?.jour ?? "")}</text>
          <text x={W - droite} y={H - 8} textAnchor="end" className="fq-axe">aujourd’hui</text>
        </svg>
        <details className="fq-table">
          <summary>Voir les valeurs</summary>
          <table>
            <thead><tr><th>Jour</th><th>Actifs</th></tr></thead>
            <tbody>{[...courbe].reverse().map((c) => <tr key={c.jour}><td>{long(c.jour)}</td><td>{c.actifs}</td></tr>)}</tbody>
          </table>
        </details>
      </figure>

      <div className="fq-complets">
        <div className="fq-complets-tete"><b>{pct} %</b><span>des membres validés ont le profil minimum ({f.complets} sur {f.valides})</span></div>
        <div className="fq-jauge" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: `${pct}%` }} /></div>
        <small>Photo, ville, pays et une ligne sur soi (les élèves sont dispensés de la ligne). {f.depuis ? `Mesure depuis le ${long(f.depuis)}.` : "La mesure commence aujourd’hui."}</small>
      </div>
    </div>
  );
}
