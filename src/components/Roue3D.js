"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Roue en perspective : un cylindre en CSS 3D pur (aucune librairie), vertical
// (domaines) ou horizontal (arrivées, promotions). On glisse au doigt pour la
// faire tourner, on touche la carte de face pour l'ouvrir, une carte de côté
// vient au centre. Un repli « liste complète » reste toujours disponible.

const P = 1300;        // perspective, en px — doit rester égale au CSS
const FENETRE = 62;    // au-delà de cet écart angulaire, la carte est effacée
const MIN_ROUE = 3;    // en dessous, une roue n'a aucun sens : liste simple

// Le pas se déduit du nombre de cartes, le rayon du pas (deux voisines doivent
// se suivre bord à bord). Trop peu de cartes pour fermer le cercle ? On garde un
// pas confortable et la roue devient un arc, borné à ses extrémités.
//
// L'échelle corrige la perspective : sans elle, la carte de face est rendue
// P/(P-rayon) fois trop grande (≈ +17 %) et ne fait plus la largeur des cartes
// du reste du site. s = P/(P+rayon) la ramène EXACTEMENT à sa taille de mise
// en page — la profondeur reste, l'agrandissement disparaît.
function geometrie(n, pitch) {
  const boucle = 360 / n <= 30;
  const pas = boucle ? 360 / n : 26;
  const rayon = Math.round((pitch / 2) / Math.tan(((pas / 2) * Math.PI) / 180));
  return { pas, boucle, rayon, echelle: P / (P + rayon) };
}

// Écart de la carte i à la face avant, ramené à [0,180], et l'opacité qui en découle.
function etat(i, angle, pas) {
  const brut = (((i * pas - angle) % 360) + 360) % 360;
  const d = brut > 180 ? 360 - brut : brut;
  const efface = d > FENETRE;
  return { efface, opacite: efface ? 0 : (1 - d / FENETRE) * 0.9 + 0.1 };
}

export default function Roue3D({
  items,
  aria,
  axe = "y",                  // "y" = roue verticale, "x" = roue horizontale
  pitch = 86,                 // hauteur (y) ou largeur + écart (x) d'une carte
  hauteur = 352,              // hauteur de la zone de la roue
  classeCarte = "tuile3d",    // habillage d'une carte (celui du reste du site)
  classeListe = "doms",       // conteneur du repli « liste complète »
}) {
  const router = useRouter();
  const [enListe, setEnListe] = useState(false);
  const refZone = useRef(null);
  const refRoue = useRef(null);
  const refPoints = useRef(null);
  const refRang = useRef(null);
  const horiz = axe === "x";
  const { pas, rayon, boucle, echelle } = geometrie(Math.max(items.length, 1), pitch);
  const N = items.length;
  // sur un arc, la 1re carte laisserait tout un côté vide : on démarre sur la 2e
  const depart = boucle ? 0 : Math.min(1, N - 1);
  const angleDepart = depart * pas;

  // rotation de la roue entière, mise à l'échelle comprise
  // la carte i est posée à +i·pas : la roue doit tourner de -angle pour l'amener
  // au centre (sur les deux axes — l'inverser laisse la face avant toujours vide)
  const tourner = (a) =>
    `scale3d(${echelle},${echelle},${echelle}) rotate${horiz ? "Y" : "X"}(${-a}deg)`;
  // pose d'une carte sur le pourtour du cylindre
  const poser = (i) =>
    `rotate${horiz ? "Y" : "X"}(${i * pas}deg) translateZ(${rayon}px)` +
    (horiz ? " translate(-50%,-50%)" : "");

  useEffect(() => {
    if (N < MIN_ROUE) return;
    const zone = refZone.current;
    const roue = refRoue.current;
    const cartes = [...roue.children];
    const DEG_PAR_PX = pas / pitch;

    let angle = angleDepart, anime = true;
    let attrape = false, depart = 0, departAngle = 0, bouge = false, carteDepart = null;

    const borner = (a) => (boucle ? a : Math.max(0, Math.min((N - 1) * pas, a)));
    const pointeur = (e) => (horiz ? e.clientX : e.clientY);

    const rendre = () => {
      roue.style.transition = anime ? "transform .42s cubic-bezier(.22,1,.36,1)" : "none";
      roue.style.transform = tourner(angle);
      const actif = ((Math.round(angle / pas) % N) + N) % N;
      cartes.forEach((t, i) => {
        const { efface, opacite } = etat(i, angle, pas);
        t.style.opacity = opacite;
        // ⚠ une carte à opacité 0 reste cliquable : sans ceci, celles de
        // l'arrière du cylindre avalent les touchers de leurs voisines.
        t.style.pointerEvents = efface ? "none" : "auto";
        t.classList.toggle("actif", i === actif);
      });
      [...refPoints.current.children].forEach((p, i) => p.classList.toggle("on", i === actif));
      refRang.current.textContent = `${actif + 1} / ${N}`;
    };

    const aller = (i, doux = true) => { anime = doux; angle = borner(i * pas); rendre(); };

    // La carte de face ouvre, une autre vient au centre par le chemin le plus court.
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
      attrape = true; bouge = false; depart = pointeur(e); departAngle = angle; anime = false;
      // la carte est retenue MAINTENANT : après setPointerCapture, l'événement
      // de clic peut être détourné vers la zone et ne plus atteindre la carte.
      carteDepart = e.target.closest("[data-i]");
      zone.setPointerCapture(e.pointerId);
    };
    const surBouger = (e) => {
      if (!attrape) return;
      const d = pointeur(e) - depart;
      if (Math.abs(d) > 4) bouge = true;
      // À la verticale, on attrape la roue par sa face avant : tirer vers le bas
      // fait descendre dans la liste — comme la molette et la flèche du bas.
      // À l'horizontale, tirer vers la gauche amène la carte de droite au centre.
      angle = borner(departAngle + (horiz ? -d : d) * DEG_PAR_PX);
      rendre();
    };
    const surLacher = () => {
      if (!attrape) return;
      attrape = false;
      if (!bouge && carteDepart) { toucher(Number(carteDepart.dataset.i)); return; }
      aller(Math.round(angle / pas));          // aimantage sur la plus proche
    };
    const surMolette = (e) => {
      const notre = horiz ? e.deltaX : e.deltaY;
      const autre = horiz ? e.deltaY : e.deltaX;
      // une molette verticale sur une roue horizontale appartient à la page
      if (Math.abs(notre) <= Math.abs(autre)) return;
      e.preventDefault();
      aller(Math.round(angle / pas) + (notre > 0 ? 1 : -1));
    };
    const surClavier = (e) => {
      const i = Math.round(angle / pas);
      const avant = horiz ? "ArrowRight" : "ArrowDown";
      const arriere = horiz ? "ArrowLeft" : "ArrowUp";
      if (e.key === avant) { e.preventDefault(); aller(i + 1); }
      if (e.key === arriere) { e.preventDefault(); aller(i - 1); }
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
  }, [N, pas, rayon, boucle, horiz, pitch, angleDepart]);

  // la liste d'origine — sert de repli, et d'affichage unique si trop peu de cartes
  const liste = (
    <div className={classeListe}>
      {items.map((it) => (
        <Link key={it.cle} href={it.href} className={classeCarte}>{it.rendu}</Link>
      ))}
    </div>
  );

  if (N < MIN_ROUE) return liste;

  return (
    <>
      <div className={enListe ? "cache3d" : ""}>
        <div className={`roue3d-zone${horiz ? " horiz" : ""}`} style={{ height: hauteur }}
          ref={refZone} tabIndex={0} role="group" aria-label={aria}>
          <div className="roue3d-scene">
            <div className="roue3d-roue" ref={refRoue} style={{ transform: tourner(angleDepart) }}>
              {items.map((it, i) => {
                const { efface, opacite } = etat(i, angleDepart, pas);
                return (
                  <Link key={it.cle} href={it.href} data-i={i} draggable={false} tabIndex={-1}
                    className={`${horiz ? "carteh3d " : ""}${classeCarte}${i === depart ? " actif" : ""}`}
                    style={{
                      transform: poser(i),
                      opacity: opacite,
                      pointerEvents: efface ? "none" : "auto",
                    }}>
                    {it.rendu}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className={horiz ? "voile3d gauche" : "voile3d haut"} />
          <div className={horiz ? "voile3d droite" : "voile3d bas"} />
          {/* points de position : sous les cartes à l'horizontale. À la verticale,
              les tuiles occupent toute la largeur — ils les chevaucheraient, et
              le repère « 3 / 14 » dit déjà où l'on est. */}
          <div className={`points3d${horiz ? " horiz" : ""}`} ref={refPoints} aria-hidden>
            {horiz && items.map((it, i) => <i key={it.cle} className={i === depart ? "on" : ""} />)}
          </div>
        </div>
        <div className="roue3d-aide">
          <small ref={refRang}>{depart + 1} / {N}</small>
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
