"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { usePathname } from "next/navigation";

// Chantier bureau : le confort de navigation du grand écran. Rendu seulement ≥ 1024 px
// (SeulementBureau, dans layout.js) — rien sur téléphone.
//   - un bouton « remonter » apparaît après 600 px de défilement (annuaire de 250 fiches, conseils…)
//   - la touche « / » met le curseur dans la recherche de l'écran (annuaire, offres, questions, messages, bibliothèque)
//   - Échap, hors d'un champ, ferme un menu ouvert en rendant le focus à la page
export default function ConfortBureau() {
  const [haut, setHaut] = useState(false);
  const chemin = usePathname();

  useEffect(() => {
    let planifie = false;
    const mesurer = () => { planifie = false; setHaut(window.scrollY > 600); };
    const auDefilement = () => { if (!planifie) { planifie = true; requestAnimationFrame(mesurer); } };
    mesurer();
    window.addEventListener("scroll", auDefilement, { passive: true });
    return () => window.removeEventListener("scroll", auDefilement);
  }, [chemin]);

  useEffect(() => {
    const dansUnChamp = (el) => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
    const touche = (e) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !dansUnChamp(document.activeElement)) {
        const champ = document.querySelector(".n-cherche input, .msg-recherche input, .bib-recherche input, input[type=search]");
        if (champ) { e.preventDefault(); champ.focus(); champ.select?.(); }
      }
      if (e.key === "Escape" && dansUnChamp(document.activeElement) && document.activeElement.value === "") document.activeElement.blur();
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, []);

  return (
    <button type="button" className={`bu-haut${haut ? " la" : ""}`} aria-label="Remonter en haut" title="Remonter en haut"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} tabIndex={haut ? 0 : -1}>
      <ArrowUp size={18} aria-hidden />
    </button>
  );
}
