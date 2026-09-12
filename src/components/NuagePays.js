"use client";

import { useMemo } from "react";
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
const MAX_PAYS = 12; // au-delà, même après relâchement, le nuage redevient dense/illisible
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

function empaqueter(entrees) {
  const max = Math.max(...entrees.map(([, n]) => n));
  const items = entrees
    .slice()
    // décroissant par effectif ; à égalité, ordre alphabétique du code —
    // sans ce second critère, deux pays à égalité peuvent se départager
    // différemment entre le rendu SERVEUR et l'hydratation CLIENT (React
    // le signale comme un décalage, sans lien avec le hasard de la spirale
    // déjà rendue déterministe plus haut).
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_PAYS)
    .map(([code, n]) => ({ code, n, r: 15 + Math.sqrt(n / max) * 42 }));

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

  if (!items.length) return null;

  return (
    <div className="np-zone">
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
            animationDelay: `${(i * 0.35).toFixed(2)}s`,
          }}
          aria-label={`${nomPays(it.code)} — ${it.n} membre${it.n > 1 ? "s" : ""}`}>
          <span className="np-disque"><img src={PAYS[it.code].drapeau} alt="" /></span>
          <span className="np-badge" aria-hidden>{it.n}</span>
        </Link>
      ))}
    </div>
  );
}
