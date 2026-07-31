"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Roue verticale en perspective : un cylindre en CSS 3D pur (aucune librairie).
// On glisse au doigt pour la faire tourner, on touche la tuile de face pour
// l'ouvrir, une tuile de côté vient au centre. Un repli « liste complète »
// reste disponible pour ceux qui préfèrent tout voir d'un coup.

const H = 86;          // hauteur d'une tuile — doit rester égale au CSS .tuile3d
const FENETRE = 62;    // au-delà de cet écart angulaire, la tuile est effacée
const MIN_ROUE = 3;    // en dessous, une roue n'a aucun sens : liste simple

// Le pas se déduit du nombre de tuiles, le rayon du pas (deux voisines doivent
// se toucher bord à bord). Trop peu de tuiles pour fermer le cercle ? On garde
// un pas confortable et la roue devient un arc, borné à ses extrémités.
function geometrie(n) {
  const boucle = 360 / n <= 30;
  const pas = boucle ? 360 / n : 26;
  return { pas, boucle, rayon: Math.round((H / 2) / Math.tan(((pas / 2) * Math.PI) / 180)) };
}

// Écart de la tuile i à la face avant, ramené à [0,180], et l'opacité qui en découle.
function etat(i, angle, pas) {
  const brut = (((i * pas - angle) % 360) + 360) % 360;
  const d = brut > 180 ? 360 - brut : brut;
  const efface = d > FENETRE;
  return { efface, opacite: efface ? 0 : (1 - d / FENETRE) * 0.9 + 0.1 };
}

export default function Roue3D({ items, aria }) {
  const router = useRouter();
  const [enListe, setEnListe] = useState(false);
  const refZone = useRef(null);
  const refRoue = useRef(null);
  const refPoints = useRef(null);
  const refRang = useRef(null);
  const { pas, rayon, boucle } = geometrie(Math.max(items.length, 1));
  const N = items.length;

  useEffect(() => {
    if (N < MIN_ROUE) return;
    const zone = refZone.current;
    const roue = refRoue.current;
    const tuiles = [...roue.children];
    const DEG_PAR_PX = pas / H;

    let angle = 0, anime = true;
    let attrape = false, departY = 0, departAngle = 0, bouge = false, tuileDepart = null;

    const borner = (a) => (boucle ? a : Math.max(0, Math.min((N - 1) * pas, a)));

    const rendre = () => {
      roue.style.transition = anime ? "transform .42s cubic-bezier(.22,1,.36,1)" : "none";
      roue.style.transform = `rotateX(${-angle}deg)`;
      const actif = ((Math.round(angle / pas) % N) + N) % N;
      tuiles.forEach((t, i) => {
        const { efface, opacite } = etat(i, angle, pas);
        t.style.opacity = opacite;
        // ⚠ une tuile à opacité 0 reste cliquable : sans ceci, celles de
        // l'arrière du cylindre avalent les touchers de leurs voisines.
        t.style.pointerEvents = efface ? "none" : "auto";
        t.classList.toggle("actif", i === actif);
      });
      [...refPoints.current.children].forEach((p, i) => p.classList.toggle("on", i === actif));
      refRang.current.textContent = `${actif + 1} / ${N}`;
    };

    const aller = (i, doux = true) => { anime = doux; angle = borner(i * pas); rendre(); };

    // La tuile de face ouvre, une autre vient au centre par le chemin le plus court.
    const toucher = (i) => {
      const actif = ((Math.round(angle / pas) % N) + N) % N;
      if (i === actif) { router.push(items[i].href); return; }
      if (!boucle) { aller(i); return; }
      const cible = i + Math.round(angle / 360) * N;
      aller([cible - N, cible, cible + N]
        .map((c) => ({ c, d: Math.abs(c - angle / pas) }))
        .sort((a, b) => a.d - b.d)[0].c);
    };

    const surDescendre = (e) => {
      attrape = true; bouge = false; departY = e.clientY; departAngle = angle; anime = false;
      // la tuile est retenue MAINTENANT : après setPointerCapture, l'événement
      // de clic peut être détourné vers la zone et ne plus atteindre la tuile.
      tuileDepart = e.target.closest(".tuile3d");
      zone.setPointerCapture(e.pointerId);
    };
    const surBouger = (e) => {
      if (!attrape) return;
      const dy = e.clientY - departY;
      if (Math.abs(dy) > 4) bouge = true;
      angle = borner(departAngle - dy * DEG_PAR_PX);
      rendre();
    };
    const surLacher = () => {
      if (!attrape) return;
      attrape = false;
      if (!bouge && tuileDepart) { toucher(Number(tuileDepart.dataset.i)); return; }
      aller(Math.round(angle / pas));          // aimantage sur la plus proche
    };
    const surMolette = (e) => {
      e.preventDefault();
      aller(Math.round(angle / pas) + (e.deltaY > 0 ? 1 : -1));
    };
    const surClavier = (e) => {
      const i = Math.round(angle / pas);
      if (e.key === "ArrowDown") { e.preventDefault(); aller(i + 1); }
      if (e.key === "ArrowUp") { e.preventDefault(); aller(i - 1); }
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toucher(((i % N) + N) % N); }
    };
    // C'est « toucher » qui décide : le lien ne navigue jamais de lui-même.
    // Exception : un clic sans coordonnées (detail 0) vient d'un lecteur
    // d'écran ou du clavier — on le laisse passer, sinon la roue leur est fermée.
    const surClic = (e) => { if (e.detail !== 0) e.preventDefault(); };

    zone.addEventListener("pointerdown", surDescendre);
    zone.addEventListener("pointermove", surBouger);
    zone.addEventListener("pointerup", surLacher);
    zone.addEventListener("pointercancel", surLacher);
    zone.addEventListener("wheel", surMolette, { passive: false });
    zone.addEventListener("keydown", surClavier);
    roue.addEventListener("click", surClic);
    rendre();

    return () => {
      zone.removeEventListener("pointerdown", surDescendre);
      zone.removeEventListener("pointermove", surBouger);
      zone.removeEventListener("pointerup", surLacher);
      zone.removeEventListener("pointercancel", surLacher);
      zone.removeEventListener("wheel", surMolette);
      zone.removeEventListener("keydown", surClavier);
      roue.removeEventListener("click", surClic);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [N, pas, rayon, boucle]);

  // la liste classique — sert de repli, et d'affichage unique si trop peu d'items
  const liste = (
    <div className="doms">
      {items.map((it) => (
        <Link key={it.cle} href={it.href} className="dom">{it.rendu}</Link>
      ))}
    </div>
  );

  if (N < MIN_ROUE) return liste;

  return (
    <>
      <div className={enListe ? "cache3d" : ""}>
        <div className="roue3d-zone" ref={refZone} tabIndex={0} role="group" aria-label={aria}>
          <div className="roue3d-scene">
            <div className="roue3d-roue" ref={refRoue}>
              {items.map((it, i) => {
                const { efface, opacite } = etat(i, 0, pas);
                return (
                  <Link key={it.cle} href={it.href} data-i={i} draggable={false} tabIndex={-1}
                    className={`tuile3d${i === 0 ? " actif" : ""}`}
                    style={{
                      transform: `rotateX(${i * pas}deg) translateZ(${rayon}px)`,
                      opacity: opacite,
                      pointerEvents: efface ? "none" : "auto",
                    }}>
                    {it.rendu}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="voile3d haut" />
          <div className="voile3d bas" />
          <div className="points3d" ref={refPoints} aria-hidden>
            {items.map((it, i) => <i key={it.cle} className={i === 0 ? "on" : ""} />)}
          </div>
        </div>
        <div className="roue3d-aide">
          <small ref={refRang}>1 / {N}</small>
          <button type="button" className="roue3d-lien" onClick={() => setEnListe(true)}>
            Voir la liste complète
          </button>
        </div>
      </div>

      <div className={enListe ? "" : "cache3d"}>
        {liste}
        <div className="roue3d-aide">
          <small>Affichage complet</small>
          <button type="button" className="roue3d-lien" onClick={() => setEnListe(false)}>
            Revenir à la roue
          </button>
        </div>
      </div>
    </>
  );
}
