"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { THEMES_CONSEIL, nomDomaine } from "@/lib/donnees";

const GENERAL = "Général";

export default function Conseils({ conseils }) {
  const [theme, setTheme] = useState("tous");

  // regroupe par thème choisi par l'auteur (défaut « Général ») ; ordre :
  // thèmes proposés d'abord, puis thèmes libres alpha, puis Général en dernier
  const groupes = useMemo(() => {
    const parTheme = {};
    for (const c of conseils) {
      const t = (c.conseil_theme ?? "").trim() || GENERAL;
      (parTheme[t] ??= []).push(c);
    }
    const noms = Object.keys(parTheme);
    const libres = noms
      .filter((n) => n !== GENERAL && !THEMES_CONSEIL.includes(n))
      .sort((a, b) => a.localeCompare(b, "fr"));
    const ordre = [...THEMES_CONSEIL.filter((t) => parTheme[t]), ...libres];
    if (parTheme[GENERAL]) ordre.push(GENERAL);
    return ordre.map((t) => ({ theme: t, items: parTheme[t] }));
  }, [conseils]);

  const visibles = theme === "tous" ? groupes : groupes.filter((g) => g.theme === theme);

  return (
    <>
      <div className="n-filtres" style={{ position: "static" }}>
        <button className={`puce${theme === "tous" ? " active" : ""}`} onClick={() => setTheme("tous")}>Tous</button>
        {groupes.map((g) => (
          <button key={g.theme} className={`puce${theme === g.theme ? " active" : ""}`} onClick={() => setTheme(g.theme)}>
            {g.theme}
          </button>
        ))}
      </div>

      <div className="n-liste" style={{ paddingTop: 4 }}>
        {visibles.map((g) => (
          <section key={g.theme} style={{ marginBottom: 8 }}>
            <h2 className="a-titre" style={{ marginBottom: 10 }}>{g.theme}</h2>
            {g.items.map((c) => (
              <div key={c.id} className="a-temoin" style={{ margin: "0 0 12px" }}>
                <p>{c.conseil}</p>
                <Link href={`/profil/${c.id}`} className="qui">
                  <Avatar profil={{ prenom: c.prenom, nom: c.nom, photo: c.photo_url }} className="am-conseil-photo" />
                  <div>
                    <b>{c.prenom} {c.nom}</b>
                    <span>Promotion {c.promotions?.numero} · {nomDomaine(c.domaine, c.domaine_precision, true)}</span>
                  </div>
                </Link>
              </div>
            ))}
          </section>
        ))}

        {groupes.length === 0 && (
          <div className="vide" style={{ paddingTop: 40 }}>
            <b>Pas encore de conseils</b>
            Les conseils aux cadets apparaîtront ici à mesure que les membres complètent leur profil.
          </div>
        )}
      </div>
    </>
  );
}
