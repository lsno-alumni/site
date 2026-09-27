"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { PASTILLES, useTourEtat, marquerDecouverte, pastillesExpirees } from "@/lib/tour";

// La pastille « Nouveau », discrète, posée sur un élément la première fois
// qu'on le croise. Un tap ouvre une bulle d'une phrase ; elle s'efface quand
// on se sert de l'élément, sur « Compris », ou 30 jours après sa première
// apparition. Rien tant que l'état n'est pas connu, pour ne pas clignoter.
export default function Nouveau({ cle, className = "" }) {
  const etat = useTourEtat();
  const [ouvert, setOuvert] = useState(false);
  const visible = !!etat && !etat.decouvertes?.includes(cle) && !pastillesExpirees(etat) && !!PASTILLES[cle];
  useEffect(() => {   // première apparition : on date le début des 30 jours
    if (visible && !etat.decouvertes?.some((d) => d.startsWith("depuis:"))) marquerDecouverte("depuis:" + new Date().toISOString().slice(0, 10));
  }, [visible, etat]);
  if (!visible) return null;
  const fermer = (e) => { e?.stopPropagation?.(); e?.preventDefault?.(); setOuvert(false); marquerDecouverte(cle); };
  return (
    <span className={`decouverte ${className}${ouvert ? " ouvert" : ""}`} onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}>
      <button type="button" className="nouveau-pastille" onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert} aria-label="Nouveau : en savoir plus">Nouveau</button>
      {ouvert && (
        <span className="nouveau-bulle" role="note">
          {PASTILLES[cle]}
          <button type="button" className="btn btn-or nouveau-compris" onClick={fermer}>Compris <X size={12} aria-hidden /></button>
        </span>
      )}
    </span>
  );
}

// à poser sur l'élément lui-même : s'en servir vaut découverte
export const decouvrir = (cle) => () => marquerDecouverte(cle);
