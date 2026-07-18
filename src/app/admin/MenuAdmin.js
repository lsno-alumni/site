"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, X, Hourglass, ShieldCheck, UserCog, Megaphone, Download, Activity } from "lucide-react";

// Accès rapide aux sections de l'espace admin — la page s'allonge avec le réseau.
const SECTIONS = [
  { id: "sec-demandes", nom: "Demandes d'inscription", Ico: Hourglass },
  { id: "sec-roles", nom: "Rôles", Ico: ShieldCheck },
  { id: "sec-gerer", nom: "Gérer un membre", Ico: UserCog },
  { id: "sec-annonce", nom: "Annonce aux membres", Ico: Megaphone },
  { id: "sec-sauvegarde", nom: "Sauvegarde", Ico: Download },
  { id: "sec-etat", nom: "État du système", Ico: Activity },
];

export default function MenuAdmin() {
  const [ouvert, setOuvert] = useState(false);
  const zone = useRef(null);

  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e) => { if (!zone.current?.contains(e.target)) setOuvert(false); };
    document.addEventListener("click", fermer);
    return () => document.removeEventListener("click", fermer);
  }, [ouvert]);

  const aller = (id) => {
    setOuvert(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div ref={zone} style={{
      // fixé : le menu reste accessible en cours de défilement ; calé sur la
      // colonne de 480px de l'app, sous la ligne « Espace admin »
      position: "fixed", top: 58, right: "max(22px, calc((100vw - 480px) / 2 + 22px))", zIndex: 60,
    }}>
      <button className="a-menu" aria-label="Sections de la page" aria-expanded={ouvert}
        onClick={() => setOuvert(!ouvert)}>
        {ouvert ? <X size={17} aria-hidden /> : <Menu size={17} aria-hidden />}
      </button>
      {ouvert && (
        <nav className="menu-panneau" style={{ top: 46, right: 0 }}>
          {SECTIONS.map(({ id, nom, Ico }) => (
            <a key={id} href={`#${id}`} onClick={(e) => { e.preventDefault(); aller(id); }}>
              <Ico size={16} strokeWidth={1.8} aria-hidden /> {nom}
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}
