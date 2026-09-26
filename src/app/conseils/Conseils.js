"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { RestaurerDefilement } from "@/components/SuiviNavigation";
import TexteReplie from "@/components/TexteReplie";
import PartagerVoix from "./PartagerVoix";
import { PenLine } from "lucide-react";
import { THEMES_CONSEIL, nomDomaine } from "@/lib/donnees";

const GENERAL = "Général";

export default function Conseils({ conseils, moiId }) {
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

  // la pastille du thème qu'on est en train de lire s'allume (sur « Tous »
  // seulement : filtré, il n'y a qu'un chapitre) et reste visible dans la
  // rangée — on sait toujours où on est dans une longue liste
  const [enVue, setEnVue] = useState(null);
  const rangee = useRef(null);
  useEffect(() => {
    if (theme !== "tous") return;
    const chapitres = Array.from(document.querySelectorAll(".c-chapitre"));
    if (!chapitres.length) return;
    const visiblesMap = new Map();
    const obs = new IntersectionObserver((entrees) => {
      for (const e of entrees) visiblesMap.set(e.target, e.isIntersecting);
      // le premier chapitre (dans l'ordre de la page) encore visible
      const courant = chapitres.find((c) => visiblesMap.get(c));
      setEnVue(courant?.dataset.theme ?? null);
    }, { rootMargin: "-120px 0px -55% 0px" });
    chapitres.forEach((c) => obs.observe(c));
    return () => obs.disconnect();
  }, [theme, groupes]);
  useEffect(() => {
    const el = rangee.current?.querySelector(".puce.en-vue");
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [enVue]);

  return (
    <>
      <div className="n-panneau">
      <div className="n-filtres" ref={rangee}>
        <button className={`puce${theme === "tous" ? " active" : ""}`} onClick={() => { setTheme("tous"); setEnVue(null); }}>Tous</button>
        {groupes.map((g) => (
          <button key={g.theme} className={`puce${theme === g.theme ? " active" : ""}${theme === "tous" && enVue === g.theme ? " en-vue" : ""}`} onClick={() => { setTheme(g.theme); setEnVue(null); }}>
            {g.theme}
          </button>
        ))}
      </div>
      </div>

      <div className="n-liste c-liste">
        {visibles.map((g) => (
          <section key={g.theme} className="c-chapitre" data-theme={g.theme}>
            {/* un chapitre par thème : titre et filet */}
            <header className="c-tete">
              <h2 className="a-titre">{g.theme}</h2>
            </header>
            {g.items.map((c, i) => (
              <div key={c.id} className={`a-temoin${i === 0 ? " c-ouverture" : ""}`}>
                <TexteReplie lignes={4}>{c.conseil}</TexteReplie>
                <div className="qui-ligne">
                  <Link href={`/profil/${c.id}`} className="qui">
                    <Avatar profil={{ prenom: c.prenom, nom: c.nom, photo: c.photo_url }} className="am-conseil-photo" />
                    <div>
                      <b>{c.prenom} {c.nom}</b>
                      <span>Promotion {c.promotions?.numero} · {nomDomaine(c.domaine, c.domaine_precision, true)}</span>
                    </div>
                  </Link>
                  <PartagerVoix id={c.id} prenom={c.prenom} />
                </div>
              </div>
            ))}
          </section>
        ))}

        {groupes.length === 0 && (
          <div className="vide" style={{ paddingTop: 40 }}>
            <b>Pas encore de conseils</b>{" "}
            Les conseils aux cadets apparaîtront ici à mesure que les membres complètent leur profil.
          </div>
        )}
      </div>
      {/* fin de page : à son tour — le conseil se saisit dans Mon profil */}
      {groupes.length > 0 && (
        <section className="n-cloture conseils">
          <h2 className="a-titre">Toi aussi, laisse un conseil</h2>
          <p>Une phrase, un regret, une astuce : ce que tu aurais aimé qu&apos;on te dise en terminale. Les cadets le liront ici, signé de ton nom.</p>
          <Link href="/mon-profil#conseil" className="btn btn-nu">
            <PenLine size={15} aria-hidden /> {moiId && conseils.some((c) => c.id === moiId) ? "Relire mon conseil" : "Écrire mon conseil"}
          </Link>
        </section>
      )}
      <RestaurerDefilement />
    </>
  );
}
