"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { nomDomaine } from "@/lib/donnees";

// « Ils viennent d'arriver » : des cartes polaroïd (photo bord à bord, prénom
// sur un bandeau papier, promo en pastille) disposées en ÉVENTAIL. La carte
// de face est nette ; les voisines se rangent derrière, inclinées. Un
// glissement horizontal passe à la suivante ; un tap sur la carte de face
// ouvre le profil, un tap sur une voisine la ramène devant. Le doigt ne
// bouge que des transform (rendu GPU, voir .tabbar dans globals.css).
export default function Eventail({ membres }) {
  const [actif, setActif] = useState(0);
  const n = membres.length;
  const zone = useRef(null);
  const glisse = useRef(null);

  useEffect(() => {
    const el = zone.current;
    if (!el || n < 2) return;
    const bas = (ev) => { glisse.current = { x: ev.clientX, y: ev.clientY, fait: false }; };
    const bouge = (ev) => {
      const g = glisse.current;
      if (!g || g.fait) return;
      const dx = ev.clientX - g.x, dy = ev.clientY - g.y;
      if (Math.abs(dx) < 28 || Math.abs(dx) < Math.abs(dy)) return;
      g.fait = true;
      setActif((a) => (a + (dx < 0 ? 1 : -1) + n) % n);
    };
    const haut = () => { glisse.current = null; };
    el.addEventListener("pointerdown", bas);
    el.addEventListener("pointermove", bouge);
    el.addEventListener("pointerup", haut);
    el.addEventListener("pointercancel", haut);
    return () => {
      el.removeEventListener("pointerdown", bas); el.removeEventListener("pointermove", bouge);
      el.removeEventListener("pointerup", haut); el.removeEventListener("pointercancel", haut);
    };
  }, [n]);

  // un glissement vient d'avoir lieu : le clic qui suit ne doit pas ouvrir un profil
  const clic = (e, i) => {
    if (glisse.current?.fait) { e.preventDefault(); return; }
    if (i !== actif) { e.preventDefault(); setActif(i); }
  };

  // grand écran : les cartes sont en rangée (bureau.css) et les flèches la font défiler ; sinon elles changent la carte de face
  const fleche = (sens) => {
    const pile = zone.current?.querySelector(".eventail-pile");
    if (pile && pile.scrollWidth > pile.clientWidth + 2) { pile.scrollBy({ left: sens * pile.clientWidth * 0.8, behavior: "smooth" }); return; }
    setActif((a) => (a + sens + n) % n);
  };
  return (
    <div className="eventail" ref={zone} role="group" aria-label="Nouveaux membres">
      {/* grand écran : deux flèches de part et d'autre (cachées sur mobile, où l'on glisse) */}
      {n > 1 && <>
        <button type="button" className="bu bu-fleche gauche" aria-label="Carte précédente" onPointerDown={(e) => e.stopPropagation()} onClick={() => fleche(-1)}><ChevronLeft size={20} aria-hidden /></button>
        <button type="button" className="bu bu-fleche droite" aria-label="Carte suivante" onPointerDown={(e) => e.stopPropagation()} onClick={() => fleche(1)}><ChevronRight size={20} aria-hidden /></button>
      </>}
      <div className="eventail-pile" style={{ "--n": n }}>
        {membres.map((m, i) => {
          // position relative à la carte de face : -1 = à gauche, 0 = devant, +1 = à droite…
          let d = i - actif;
          if (d > n / 2) d -= n;
          if (d < -n / 2) d += n;
          return (
            <Link key={m.id} href={`/profil/${m.id}`} className={`polaroid${d === 0 ? " devant" : ""}`}
              style={{ "--d": d, zIndex: 10 - Math.abs(d) }} onClick={(e) => clic(e, i)}
              aria-hidden={d !== 0} tabIndex={d === 0 ? 0 : -1} draggable={false}>
              {m.photo_url
                ? <img className="polaroid-photo" src={m.photo_url} alt="" draggable={false} />
                : <>
                    <span className="polaroid-photo polaroid-init">{(m.prenom[0] + (m.nom?.[0] ?? "")).toUpperCase()}</span>
                    <img className="polaroid-blason" src="/img/logo.jpg" alt="" draggable={false} />
                  </>}
              <span className="polaroid-promo">P{m.promotions?.numero}</span>
              <span className="polaroid-nom">
                <b>{m.prenom}</b>
                <small>{nomDomaine(m.domaine, m.domaine_precision, true)}</small>
              </span>
            </Link>
          );
        })}
      </div>
      {n > 1 && (
        <div className="eventail-points" aria-hidden>
          {membres.map((m, i) => <i key={m.id} className={i === actif ? "on" : ""} />)}
        </div>
      )}
      {n > 1 && <p className="eventail-aide"><span className="bu-tel">Glisse pour voir les suivants</span><span className="bu">Les flèches, ou un clic sur une carte voisine</span></p>}
    </div>
  );
}
