"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X, ArrowRight, Check } from "lucide-react";
import { CARTES, marquerTourVu } from "@/lib/tour";

// Le tour de bienvenue : six cartes plein écran qu'on fait glisser, une par
// nouveauté. « Passer » à tout moment ; sur la dernière, « C'est parti »
// ouvre l'écran concerné. Vu une fois par compte (migration 72).
export default function TourNouveautes({ onFermer, cartes = CARTES }) {
  const routeur = useRouter();
  const [i, setI] = useState(0);
  const rail = useRef(null);
  const n = cartes.length;

  const aller = (k) => {
    const cible = Math.max(0, Math.min(n - 1, k));
    rail.current?.children[cible]?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    setI(cible);
  };
  const surDefilement = () => {
    const r = rail.current; if (!r) return;
    const k = Math.round(r.scrollLeft / r.clientWidth);
    if (k !== i) setI(Math.max(0, Math.min(n - 1, k)));
  };
  const terminer = (lien) => {
    marquerTourVu();
    onFermer?.();
    if (lien) routeur.push(lien);
  };
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const touche = (e) => {
      if (e.key === "Escape") terminer();
      if (e.key === "ArrowRight") aller(i + 1);
      if (e.key === "ArrowLeft") aller(i - 1);
    };
    document.addEventListener("keydown", touche);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", touche); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  const c = cartes[i];

  return createPortal(
    <div className="tour" role="dialog" aria-modal="true" aria-label="Les nouveautés du réseau">
      <header className="tour-tete">
        <span className="tour-points" aria-hidden>{cartes.map((x, k) => <i key={x.cle} className={k === i ? "on" : k < i ? "vu" : ""} />)}</span>
        <button type="button" className="tour-passer" onClick={() => terminer()}>Passer <X size={14} aria-hidden /></button>
      </header>
      <div className="tour-rail" ref={rail} onScroll={surDefilement}>
        {cartes.map((x) => (
          <section key={x.cle} className="tour-carte" aria-label={x.titre}>
            <div className="tour-cadre">
              <img src={x.image} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
            </div>
            <small className="tour-nouveau">Nouveau</small>
            <h2>{x.titre}</h2>
            <p className="tour-accroche">{x.accroche}</p>
            <ul className="tour-liste">{x.points.map((p) => <li key={p}><Check size={14} aria-hidden /> {p}</li>)}</ul>
          </section>
        ))}
      </div>
      <footer className="tour-pied">
        <small>{i + 1} / {n}</small>
        {i < n - 1
          ? <button type="button" className="btn btn-or tour-suivant" onClick={() => aller(i + 1)}>Suivant <ArrowRight size={16} aria-hidden /></button>
          : <button type="button" className="btn btn-or tour-suivant" onClick={() => terminer(c.lien)}>C’est parti <ArrowRight size={16} aria-hidden /></button>}
      </footer>
    </div>,
    document.body
  );
}
