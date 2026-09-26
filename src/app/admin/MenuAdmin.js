"use client";

import { useEffect, useState } from "react";

// Sommaire de l'espace admin : une rangée de pastilles collée sous la tête,
// comme les filtres de l'annuaire ou le sommaire des Conditions (elle
// remplace le bouton ☰ flottant, qui se posait sur le contenu au défilement).
// La pastille de la section en cours de lecture s'allume.
const SECTIONS = [
  { id: "sec-demandes", nom: "Demandes" },
  { id: "sec-reseau", nom: "Le réseau" },
  { id: "sec-roles", nom: "Rôles" },
  { id: "sec-gerer", nom: "Gérer un membre" },
  { id: "sec-annonce", nom: "Annonce" },
  { id: "sec-journal", nom: "Journal" },
  { id: "sec-sauvegarde", nom: "Sauvegarde" },
  { id: "sec-etat", nom: "État du système" },
];

export default function MenuAdmin() {
  const [enVue, setEnVue] = useState(null);

  useEffect(() => {
    const cibles = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean);
    if (!cibles.length) return;
    const visibles = new Map();
    const obs = new IntersectionObserver((entrees) => {
      for (const e of entrees) visibles.set(e.target.id, e.isIntersecting);
      const courant = SECTIONS.find((s) => visibles.get(s.id));
      setEnVue(courant?.id ?? null);
    }, { rootMargin: "-90px 0px -60% 0px" });
    cibles.forEach((c) => obs.observe(c));
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    document.querySelector(".ad-sommaire .puce.en-vue")?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [enVue]);

  const aller = (e, id) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav className="n-panneau ad-sommaire" aria-label="Sections de l'espace admin">
      <div className="n-filtres">
        {SECTIONS.map(({ id, nom }) => (
          <a key={id} href={`#${id}`} className={`puce${enVue === id ? " en-vue" : ""}`} onClick={(e) => aller(e, id)}>{nom}</a>
        ))}
      </div>
    </nav>
  );
}
