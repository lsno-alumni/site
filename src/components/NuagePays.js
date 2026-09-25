"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { PAYS, nomPays } from "@/lib/donnees";

// Nuage de bulles : un pays = une bulle, sa TAILLE suit son effectif (aire
// proportionnelle, pas le rayon — sinon un pays 4× plus peuplé semblerait
// seulement 2× plus gros). Empaquetage en spirale : chaque bulle part d'un
// angle déterministe (nombre d'or, jamais Math.random() — un rendu SERVEUR
// suivi d'une hydratation CLIENT doivent produire EXACTEMENT la même
// disposition, sinon React signale un décalage) et s'éloigne du centre
// jusqu'à trouver une place libre ; si aucune place n'est parfaitement
// libre (nuage dense), on garde la MOINS mauvaise plutôt que d'empiler deux
// bulles au même endroit.
const TAILLE = 320; // repère interne (unités arbitraires, mis à l'échelle en % au rendu)
const ANGLE_OR = 2.399963; // nombre d'or en radians — répartition de départ organique
const MARGE = 14; // laisse la place au badge de compte, qui déborde du cercle propre à chaque bulle
const ECART_MIN = 12; // écart minimal souhaité ENTRE deux bulles (pour le badge du voisin)

function pireChevauchement(x, y, r, placees) {
  let pire = 0;
  for (const p of placees) {
    const manque = p.r + r + ECART_MIN - Math.hypot(p.x - x, p.y - y);
    if (manque > pire) pire = manque;
  }
  return pire;
}

const bloque = (v, min, max) => Math.min(max, Math.max(min, v));

// Passe de relâchement : l'empaquetage en spirale (ci-dessous) est glouton
// et peut, avec beaucoup de bulles de tailles très inégales, être contraint
// à garder un « moins mauvais » chevauchement faute de place trouvée. Ce
// second passage écarte chaque paire qui se chevauche ENCORE, à parts
// égales le long de l'axe qui les relie, jusqu'à ce que plus rien ne se
// touche (ou que le nombre d'itérations soit épuisé) — un classique pour
// des nuages de bulles, garantit un résultat propre même quand la spirale
// seule ne suffit pas.
function relacher(items) {
  for (let iter = 0; iter < 300; iter++) {
    let bouge = false;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        const distMin = a.r + b.r + ECART_MIN;
        if (dist < distMin) {
          bouge = true;
          const decalage = (distMin - dist) / 2;
          const nx = dx / dist, ny = dy / dist;
          a.x = bloque(a.x - nx * decalage, a.r + MARGE, TAILLE - a.r - MARGE);
          a.y = bloque(a.y - ny * decalage, a.r + MARGE, TAILLE - a.r - MARGE);
          b.x = bloque(b.x + nx * decalage, b.r + MARGE, TAILLE - b.r - MARGE);
          b.y = bloque(b.y + ny * decalage, b.r + MARGE, TAILLE - b.r - MARGE);
        }
      }
    }
    if (!bouge) break;
  }
}

// Empreinte stable d'un code pays (ex. « BF ») : sert à mélanger l'ordre
// de placement sans hasard, donc sans décalage serveur/client.
function empreinte(code) {
  let h = 0;
  for (const c of code) h = (h * 31 + c.charCodeAt(0)) % 9973;
  return (h * 7919) % 1000;
}

function empaqueter(entrees) {
  const max = Math.max(...entrees.map(([, n]) => n));
  // TOUS les pays présents s'affichent (aucun plafond) — la taille de base
  // et l'écart entre le plus petit et le plus grand cercle RÉTRÉCISSENT
  // avec le nombre de pays, pour que le nuage reste lisible même si le
  // réseau s'étend demain à bien plus de 16 pays sans qu'on ait à y retoucher.
  const nb = entrees.length;
  const rBase = Math.max(10, 18 - nb * 0.25);
  const rGain = Math.max(20, 46 - nb * 1.1);
  const items = entrees
    .slice()
    // ordre de placement MÉLANGÉ (mais déterministe : identique au serveur
    // et au client) — trié par effectif, les gros se posaient au centre et
    // les petits en anneau, ce qui dessinait des bandes bleu-blanc-rouge ;
    // mélangés, gros et petits se côtoient partout dans le nuage
    .sort((a, b) => empreinte(a[0]) - empreinte(b[0]))
    .map(([code, n]) => ({ code, n, r: rBase + Math.sqrt(n / max) * rGain }));

  const placees = [];
  items.forEach((it, i) => {
    let angle = i * ANGLE_OR;
    let radius = 0;
    let tries = 0;
    let meilleur = null;
    let meilleurScore = Infinity;
    while (tries < 6000) {
      const x = TAILLE / 2 + radius * Math.cos(angle);
      const y = TAILLE / 2 + radius * Math.sin(angle);
      const dedans = x - it.r >= MARGE && x + it.r <= TAILLE - MARGE && y - it.r >= MARGE && y + it.r <= TAILLE - MARGE;
      if (dedans) {
        const score = pireChevauchement(x, y, it.r, placees);
        if (score < meilleurScore) { meilleurScore = score; meilleur = { x, y }; }
        if (score <= 0) break;
      }
      angle += 0.28;
      radius += 0.9;
      tries++;
    }
    it.x = meilleur.x;
    it.y = meilleur.y;
    placees.push(it);
  });
  relacher(items);
  return items;
}

export default function NuagePays({ parPays }) {
  const items = useMemo(() => {
    const entrees = Object.entries(parPays ?? {}).filter(([code, n]) => PAYS[code] && n > 0);
    return entrees.length ? empaqueter(entrees) : [];
  }, [parPays]);

  const zone = useRef(null);

  // Mouvement lancé après l'hydratation (le rendu serveur ne connaît pas le
  // hasard). Chaque bulle dérive LENTEMENT autour de sa place (vitesse et
  // direction propres, petite agitation continue, rebond dans un enclos),
  // est repoussée par ses voisines si elles se touchent — et peut être
  // ATTRAPÉE au doigt : on la déplace, elle bouscule les autres, et là où on
  // la lâche devient sa nouvelle place, d'où elle reprend sa dérive.
  // Un seul transform par bulle, calculé à chaque image : rendu GPU, pas de
  // flou ni d'opacité en mouvement (voir .tabbar).
  useEffect(() => {
    const zoneEl = zone.current;
    if (!zoneEl) return;
    const bulles = Array.from(zoneEl.querySelectorAll(".np-bulle"));
    if (bulles.length < 2) return;
    const calme = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const largeur = () => zoneEl.getBoundingClientRect().width || TAILLE;
    const AMPLITUDE = 6;   // px : rayon de l'enclos autour de la place de repos
    const V_MAX = 5;       // px/s : la dérive reste paisible
    const SEUIL_TAP = 6;   // px : en deçà, c'est un tap (le lien s'ouvre), pas un déplacement
    // position de repos (unités du repère) + écart courant (px) + vitesse (px/s)
    const etat = items.map((it) => {
      const a = Math.random() * Math.PI * 2;
      const v = 1.5 + Math.random() * 2.5;
      return { r: it.r, cx: it.x, cy: it.y, x: 0, y: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v, tenue: false };
    });
    const poser = (i) => { bulles[i].style.transform = `translate(${etat[i].x.toFixed(2)}px, ${etat[i].y.toFixed(2)}px)`; };
    // la bulle tenue impose sa position ; on écarte celles qu'elle rencontre
    const bousculer = (i, echelle) => {
      const e = etat[i];
      for (let j = 0; j < etat.length; j++) {
        if (j === i) continue;
        const f = etat[j];
        const dx = (f.cx * echelle + f.x) - (e.cx * echelle + e.x);
        const dy = (f.cy * echelle + f.y) - (e.cy * echelle + e.y);
        const d = Math.hypot(dx, dy) || 1;
        const mini = (e.r + f.r) * echelle + 4;
        if (d < mini) {
          const pousse = mini - d;
          // la bulle bousculée change de PLACE (pas seulement d'écart) : elle
          // ne reviendra pas se coller à la bulle déplacée
          f.cx += (dx / d) * pousse / echelle;
          f.cy += (dy / d) * pousse / echelle;
          f.cx = bloque(f.cx, f.r + MARGE, TAILLE - f.r - MARGE);
          f.cy = bloque(f.cy, f.r + MARGE, TAILLE - f.r - MARGE);
          bulles[j].style.left = `${(((f.cx - f.r) * 100) / TAILLE).toFixed(4)}%`;
          bulles[j].style.top = `${(((f.cy - f.r) * 100) / TAILLE).toFixed(4)}%`;
          f.vx += (dx / d) * 4; f.vy += (dy / d) * 4;   // petit élan dans le sens de la poussée
          bousculer(j, echelle);                          // et elle bouscule à son tour
        }
      }
    };
    let precedent = performance.now();
    let anim = 0;
    let visible = true;
    const pas = (t) => {
      const dt = Math.min(0.05, (t - precedent) / 1000);
      precedent = t;
      const echelle = largeur() / TAILLE;
      for (let i = 0; i < etat.length; i++) {
        const e = etat[i];
        if (e.tenue || calme) continue;
        e.vx += (Math.random() - 0.5) * 3 * dt;
        e.vy += (Math.random() - 0.5) * 3 * dt;
        for (let j = 0; j < etat.length; j++) {
          if (i === j) continue;
          const f = etat[j];
          const dx = (e.cx * echelle + e.x) - (f.cx * echelle + f.x);
          const dy = (e.cy * echelle + e.y) - (f.cy * echelle + f.y);
          const d = Math.hypot(dx, dy) || 1;
          const mini = (e.r + f.r) * echelle + 4;
          if (d < mini) { e.vx += (dx / d) * 20 * dt; e.vy += (dy / d) * 20 * dt; }
        }
        const vit = Math.hypot(e.vx, e.vy);
        if (vit > V_MAX) { e.vx *= V_MAX / vit; e.vy *= V_MAX / vit; }
        e.x += e.vx * dt; e.y += e.vy * dt;
        if (Math.abs(e.x) > AMPLITUDE) { e.x = Math.sign(e.x) * AMPLITUDE; e.vx *= -1; }
        if (Math.abs(e.y) > AMPLITUDE) { e.y = Math.sign(e.y) * AMPLITUDE; e.vy *= -1; }
        poser(i);
      }
      if (visible) anim = requestAnimationFrame(pas);
    };
    anim = requestAnimationFrame(pas);
    const obs = new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      if (visible) { precedent = performance.now(); anim = requestAnimationFrame(pas); }
      else cancelAnimationFrame(anim);
    });
    obs.observe(zoneEl);

    // ---- prise au doigt / à la souris ----
    const retraits = [];
    bulles.forEach((el, i) => {
      let depart = null, deplace = false;
      const bas = (ev) => {
        if (ev.button !== undefined && ev.button !== 0) return;
        depart = { px: ev.clientX, py: ev.clientY };
        deplace = false;
        etat[i].tenue = true;
        el.setPointerCapture?.(ev.pointerId);
        el.classList.add("tenue");
      };
      const bouge = (ev) => {
        if (!depart) return;
        const dx = ev.clientX - depart.px, dy = ev.clientY - depart.py;
        if (!deplace && Math.hypot(dx, dy) < SEUIL_TAP) return;
        deplace = true;
        ev.preventDefault();
        const echelle = largeur() / TAILLE;
        // la bulle suit le doigt : on déplace sa PLACE, l'écart reste petit
        const e = etat[i];
        e.cx = bloque(e.cx + dx / echelle, e.r + MARGE, TAILLE - e.r - MARGE);
        e.cy = bloque(e.cy + dy / echelle, e.r + MARGE, TAILLE - e.r - MARGE);
        depart.px = ev.clientX; depart.py = ev.clientY;
        e.x = 0; e.y = 0; e.vx = 0; e.vy = 0; poser(i);
        el.style.left = `${(((e.cx - e.r) * 100) / TAILLE).toFixed(4)}%`;
        el.style.top = `${(((e.cy - e.r) * 100) / TAILLE).toFixed(4)}%`;
        bousculer(i, echelle);
      };
      const haut = (ev) => {
        if (!depart) return;
        etat[i].tenue = false;
        el.classList.remove("tenue");
        el.releasePointerCapture?.(ev.pointerId);
        // un vrai déplacement ne doit pas ouvrir le lien au relâchement
        if (deplace) { const stop = (c) => { c.preventDefault(); el.removeEventListener("click", stop, true); }; el.addEventListener("click", stop, true); setTimeout(() => el.removeEventListener("click", stop, true), 0); }
        depart = null;
      };
      // à la souris, le navigateur lance sinon un glisser-déposer natif du lien,
      // qui coupe la prise en cours (pointercancel) — au toucher rien à faire
      const pasDeDrag = (ev) => ev.preventDefault();
      el.addEventListener("dragstart", pasDeDrag);
      el.addEventListener("pointerdown", bas);
      el.addEventListener("pointermove", bouge);
      el.addEventListener("pointerup", haut);
      el.addEventListener("pointercancel", haut);
      retraits.push(() => {
        el.removeEventListener("dragstart", pasDeDrag);
        el.removeEventListener("pointerdown", bas); el.removeEventListener("pointermove", bouge);
        el.removeEventListener("pointerup", haut); el.removeEventListener("pointercancel", haut);
      });
    });
    return () => { cancelAnimationFrame(anim); obs.disconnect(); retraits.forEach((f) => f()); };
  }, [items]);

  if (!items.length) return null;

  return (
    <div className="np-zone" ref={zone}>
      {items.map((it, i) => (
        <Link key={it.code} href={`/annuaire?pays=${it.code}`} className="np-bulle"
          style={{
            // précision FIXE (toFixed) : un nombre à virgule flottante posé
            // tel quel peut se sérialiser différemment entre le HTML rendu
            // par le SERVEUR (parfois arrondi) et le calcul fait par le
            // CLIENT à l'hydratation (pleine précision IEEE754) — React
            // signale alors un décalage même si c'est « la même » valeur.
            width: `${((it.r * 2 * 100) / TAILLE).toFixed(4)}%`,
            height: `${((it.r * 2 * 100) / TAILLE).toFixed(4)}%`,
            left: `${(((it.x - it.r) * 100) / TAILLE).toFixed(4)}%`,
            top: `${(((it.y - it.r) * 100) / TAILLE).toFixed(4)}%`,
          }}
          data-i={i}
          aria-label={`${nomPays(it.code)} — ${it.n} membre${it.n > 1 ? "s" : ""}`}>
          <span className="np-disque"><img src={PAYS[it.code].drapeau} alt="" /></span>
          <span className="np-badge" aria-hidden>{it.n}</span>
        </Link>
      ))}
    </div>
  );
}
