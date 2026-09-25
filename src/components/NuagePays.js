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

  // Mouvement VRAIMENT aléatoire, lancé après l'hydratation (le rendu
  // serveur ne connaît pas le hasard) : chaque bulle a sa propre vitesse et
  // sa propre direction, rebondit sur les bords de son petit enclos (rayon
  // AMPLITUDE) et est repoussée par ses voisines si elles se rapprochent
  // trop. Un seul transform par bulle, calculé à chaque image : rendu GPU,
  // pas de flou ni d'opacité en mouvement (voir .tabbar).
  useEffect(() => {
    const zoneEl = zone.current;
    if (!zoneEl || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bulles = Array.from(zoneEl.querySelectorAll(".np-bulle"));
    if (bulles.length < 2) return;
    const largeur = () => zoneEl.getBoundingClientRect().width || TAILLE;
    const AMPLITUDE = 7;          // px : rayon de l'enclos de chaque bulle
    const etat = items.map((it) => {
      const a = Math.random() * Math.PI * 2;
      const v = 6 + Math.random() * 10;  // px/s
      return { x: 0, y: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: it.r, cx: it.x, cy: it.y };
    });
    let precedent = performance.now();
    let anim = 0;
    let visible = true;
    const pas = (t) => {
      const dt = Math.min(0.05, (t - precedent) / 1000);
      precedent = t;
      const echelle = largeur() / TAILLE;  // unités du repère → px
      for (let i = 0; i < etat.length; i++) {
        const e = etat[i];
        // petite agitation aléatoire : la trajectoire ne se répète jamais
        e.vx += (Math.random() - 0.5) * 12 * dt;
        e.vy += (Math.random() - 0.5) * 12 * dt;
        // répulsion douce entre voisines qui se rapprochent
        for (let j = 0; j < etat.length; j++) {
          if (i === j) continue;
          const f = etat[j];
          const dx = (e.cx * echelle + e.x) - (f.cx * echelle + f.x);
          const dy = (e.cy * echelle + e.y) - (f.cy * echelle + f.y);
          const d = Math.hypot(dx, dy) || 1;
          const mini = (e.r + f.r) * echelle + 6;
          if (d < mini) { e.vx += (dx / d) * 30 * dt; e.vy += (dy / d) * 30 * dt; }
        }
        // vitesse bornée
        const vit = Math.hypot(e.vx, e.vy);
        if (vit > 18) { e.vx *= 18 / vit; e.vy *= 18 / vit; }
        e.x += e.vx * dt; e.y += e.vy * dt;
        // rebond sur l'enclos
        if (Math.abs(e.x) > AMPLITUDE) { e.x = Math.sign(e.x) * AMPLITUDE; e.vx *= -1; }
        if (Math.abs(e.y) > AMPLITUDE) { e.y = Math.sign(e.y) * AMPLITUDE; e.vy *= -1; }
        bulles[i].style.transform = `translate(${e.x.toFixed(2)}px, ${e.y.toFixed(2)}px)`;
      }
      if (visible) anim = requestAnimationFrame(pas);
    };
    anim = requestAnimationFrame(pas);
    // on ne bouge que si la zone est à l'écran : pas de calcul pour rien
    const obs = new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      if (visible) { precedent = performance.now(); anim = requestAnimationFrame(pas); }
      else cancelAnimationFrame(anim);
    });
    obs.observe(zoneEl);
    return () => { cancelAnimationFrame(anim); obs.disconnect(); };
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
