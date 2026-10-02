"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

// Un média (photo, vidéo, vocal) qui ne reste pas vide sur une connexion
// capricieuse. Si le chargement échoue, on réessaie tout seul trois fois
// (1 s, 3 s, 8 s), puis on montre un bouton « Réessayer » au lieu d'un
// rectangle muet.
// ⚠ Recréer la balise avec la même adresse ne suffit pas : Chrome garde
// l'échec en mémoire pour la durée de la page et ne redemande rien. Les
// nouvelles tentatives passent donc par un fetch « reload » (qui traverse le
// service worker et remplit son cache), et le fichier reçu est affiché via une
// adresse blob:.
const DELAIS = [1000, 3000, 8000];

export function useReessai(src) {
  const [etat, setEtat] = useState({ src, affiche: src, essai: 0, echec: false });
  if (src !== etat.src) setEtat({ src, affiche: src, essai: 0, echec: false });   // nouvelle adresse : on repart (réglage pendant le rendu)
  const minuteur = useRef(null);
  const blob = useRef(null);
  useEffect(() => () => { clearTimeout(minuteur.current); if (blob.current) URL.revokeObjectURL(blob.current); }, []);

  const tenter = async (n) => {
    try {
      const r = await fetch(src, { mode: "cors", cache: "reload", credentials: "omit" });
      if (!r.ok) throw new Error(String(r.status));
      const b = await r.blob();
      if (blob.current) URL.revokeObjectURL(blob.current);
      blob.current = URL.createObjectURL(b);
      setEtat((e) => (e.src === src ? { ...e, affiche: blob.current, essai: n } : e));
    } catch {
      if (n < DELAIS.length) { clearTimeout(minuteur.current); minuteur.current = setTimeout(() => tenter(n + 1), DELAIS[n]); }
      else setEtat((e) => (e.src === src ? { ...e, echec: true } : e));
    }
  };
  const surErreur = () => {
    if (etat.affiche !== etat.src) { setEtat((e) => ({ ...e, echec: true })); return; }   // le fichier reçu ne se lit pas : inutile d'insister
    if (etat.essai > 0 || etat.echec) return;
    setEtat((e) => ({ ...e, essai: 1 }));
    clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => tenter(1), DELAIS[0]);
  };
  const reessayer = (e) => { e?.stopPropagation?.(); e?.preventDefault?.(); setEtat((x) => ({ ...x, affiche: src, essai: 1, echec: false })); tenter(1); };
  return { cle: etat.affiche, srcAffiche: etat.affiche, echec: etat.echec, surErreur, reessayer };
}

export function BoutonReessayer({ onClick, className = "" }) {
  return (
    <button type="button" className={`media-reessayer ${className}`} onClick={onClick}>
      <RefreshCw size={16} aria-hidden /> Réessayer
    </button>
  );
}

// <img> robuste : mêmes attributs qu'une image, plus le bouton en cas d'échec
export default function ImageRobuste({ src, className = "", classeEchec = "", ...props }) {
  const { cle, srcAffiche, echec, surErreur, reessayer } = useReessai(src);
  if (!src) return null;
  if (echec) return <span className={`media-echec ${classeEchec || className}`}><BoutonReessayer onClick={reessayer} /></span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img key={cle} src={srcAffiche} className={className} onError={surErreur} {...props} />;
}
