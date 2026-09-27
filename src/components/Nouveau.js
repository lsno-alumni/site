"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { PASTILLES, useTourEtat, marquerDecouverte } from "@/lib/tour";

// La pastille « Nouveau » posée sur un élément la première fois qu'on le
// croise. Un tap ouvre une bulle d'une phrase ; « Compris » la retire pour de
// bon (portée par le compte). Rien tant que l'état n'est pas connu, pour ne
// pas clignoter.
export default function Nouveau({ cle, className = "" }) {
  const etat = useTourEtat();
  const [ouvert, setOuvert] = useState(false);
  if (!etat || etat.decouvertes?.includes(cle)) return null;
  const texte = PASTILLES[cle];
  if (!texte) return null;
  const fermer = (e) => { e?.stopPropagation?.(); e?.preventDefault?.(); setOuvert(false); marquerDecouverte(cle); };
  return (
    <span className={`decouverte ${className}${ouvert ? " ouvert" : ""}`} onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}>
      <button type="button" className="nouveau-pastille" onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert} aria-label="Nouveau : en savoir plus">
        <Sparkles size={11} aria-hidden /> Nouveau
      </button>
      {ouvert && (
        <span className="nouveau-bulle" role="note">
          {texte}
          <button type="button" className="btn btn-or nouveau-compris" onClick={fermer}>Compris <X size={12} aria-hidden /></button>
        </span>
      )}
    </span>
  );
}
