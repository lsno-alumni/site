"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { X, ArrowLeft } from "lucide-react";

// Feuille qui glisse par-dessus la page (façon LinkedIn) : ouverte à mi-écran
// (aperçu), on tire la « prise » (tête, purement visuelle) vers le haut pour
// l'agrandir en plein écran, vers le bas pour la refermer. Le contenu ne
// change pas entre les deux états — seule la hauteur visible varie, comme
// sur un vrai bottom sheet. Bloque le défilement de la page pendant qu'elle
// est ouverte (même principe que Visionneuse.js) : la liste derrière reste
// IMMOBILE pendant le geste, pour ne pas reproduire le bug GPU de la tabbar
// (couche translucide qui bouge PENDANT qu'une liste défile).
//
// ⚠ La zone de prise (tete) doit rester PUREMENT VISUELLE (photo, nom,
// badges…) — jamais de bouton ni de champ dedans : le geste capture le
// pointeur sur toute cette zone, un clic sur un bouton qui s'y trouverait
// serait avalé par le glissement. Les boutons/formulaires vont dans
// `children` (défilant), jamais dans `tete`.
const PEEK = 0.7; // fraction de l'écran COUVERTE (pas le décalage) à l'ouverture

// depart="plein" : la feuille monte du bas et s'ouvre ENTIÈREMENT d'un seul
// mouvement (le composer du Fil) — même façon d'apparaître qu'une feuille,
// sans l'étape à mi-écran. sansFermer : le contenu a déjà son propre bouton.
// Relais entre deux feuilles qui se succèdent sans transition : la silhouette
// d'attente (loading.js) puis la vraie feuille avec ses données. La seconde
// reprend la position exacte de la première, sans rejouer la montée — sinon
// l'animation se faisait deux fois (signalé le 02/10).
// `vivantes` compte les feuilles montées : quand la vraie feuille se rend, la
// silhouette est ENCORE là (elle ne se démonte qu'au même commit) — c'est ce
// constat qui fait foi, pas un délai (sur téléphone le contenu peut mettre
// plusieurs secondes, un délai expirait et la montée se rejouait).
let relais = { etat: null, quand: 0 };
let vivantes = 0;
const RELAIS_MS = 400;

export default function FeuilleGlissante({ tete, children, onFermer, depart = "peek", sansFermer = false }) {
  // ce qui fait foi : une feuille déjà DANS LA PAGE au moment où celle-ci se
  // rend (la silhouette est encore là) — lu dans le DOM, donc indépendant du
  // partage de ce module entre morceaux de code ; le relais module en secours
  const [reprise] = useState(() => {
    if (typeof document !== "undefined") {
      const autre = document.querySelector(".fg-feuille[data-etat]");
      if (autre && autre.dataset.etat !== "ferme") return autre.dataset.etat;
    }
    return relais.etat && relais.etat !== "ferme" && (vivantes > 0 || Date.now() - relais.quand < RELAIS_MS) ? relais.etat : null;
  });
  const [etat, setEtat] = useState(reprise ?? depart); // peek | plein | ferme
  const etatRef = useRef(reprise ?? depart);
  const feuilleRef = useRef(null);
  const priseRef = useRef(null);
  const poigneeRef = useRef(null);
  const hauteurRef = useRef(typeof window !== "undefined" ? window.innerHeight : 800);

  // PEEK est la part COUVERTE de l'écran — la position (distance depuis le
  // haut) est donc l'inverse, h * (1 - PEEK)
  const positionPour = (e) => {
    const h = hauteurRef.current;
    if (e === "ferme") return h;
    if (e === "peek") return h * (1 - PEEK);
    return 0;
  };

  // en plein écran, l'encoche n'a plus d'utilité (rien à découvrir plus
  // haut) — elle réapparaît dès qu'on recommence à tirer vers le bas
  // (descendre), avant même que l'état ait fini de basculer
  const majPoignee = (visible) => {
    if (poigneeRef.current) poigneeRef.current.style.opacity = visible ? "1" : "0";
  };

  // appliquer : la partie DOM seule (position, coins, défilement) ; aller : l'état avec
  const appliquer = (e, animee = true) => {
    majPoignee(e !== "plein");
    const f = feuilleRef.current;
    if (!f) return;
    f.style.transition = animee ? "" : "none";
    f.style.transform = `translateY(${positionPour(e)}px)`;
    // plein écran = ce doit être INDISTINGUABLE de la vraie page : coins
    // carrés, tout défile ensemble (plus de tête figée à part), et le geste
    // de glissement cesse (sinon il entre en conflit avec le défilement
    // normal de la couverture/photo une fois qu'on y revient en scrollant)
    f.style.borderRadius = e === "plein" ? "0" : "";
    f.style.overflowY = e === "plein" ? "auto" : "hidden";
    // le sol de la feuille (kraft, --fond-profil) est le même que celui de la
    // vraie /profil/[id] (.page-profil) : rien à changer en plein écran —
    // un aplat posé ici effaçait le grain dès l'ouverture complète
    // sinon un doigt qui touche la couverture en plein écran ne ferait RIEN
    // (ni glissement — désactivé plus haut —, ni défilement natif, avalé
    // par ce touch-action resté à "none")
    if (priseRef.current) priseRef.current.style.touchAction = e === "plein" ? "auto" : "none";
    // 100dvh peut différer de la vraie hauteur de fenêtre selon le navigateur
    // (barre d'adresse mobile, zoom…) — au repos ça ne se voit pas (seule une
    // PARTIE de la feuille est visible), mais en plein écran le moindre écart
    // laisse un filet de la page derrière en haut. On fixe alors top+bottom
    // ensemble : le navigateur calcule la hauteur exacte entre les deux,
    // sans dépendre de l'unité dvh.
    f.style.top = e === "plein" ? "0" : "";
    f.style.height = e === "plein" ? "auto" : "";
    if (e === "ferme") setTimeout(onFermer, animee ? 280 : 0);
  };
  const aller = (e, animee = true) => {
    setEtat(e);
    etatRef.current = e;
    relais = { etat: e, quand: Date.now() };
    appliquer(e, animee);
  };

  // Anime l'ENTRÉE au montage sans passer par setEtat : l'état initial
  // ("peek") est déjà correct, seule la position VISUELLE (fermée → mi-écran)
  // doit s'animer — un pur ajustement du DOM, pas une synchronisation d'état.
  // reprise : la position est posée AVANT la première peinture (sinon, sur un
  // téléphone lent, la feuille apparaissait un instant tout en bas — la
  // position par défaut du CSS — puis remontait : l'animation « deux fois »)
  useLayoutEffect(() => {
    if (!reprise) return;
    hauteurRef.current = window.innerHeight;
    relais = { etat: reprise, quand: Date.now() };
    appliquer(reprise, false);   // l'état vaut déjà `reprise` : rien à synchroniser
    const f = feuilleRef.current;
    requestAnimationFrame(() => { if (f) f.style.transition = ""; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    vivantes += 1;
    hauteurRef.current = window.innerHeight;
    document.body.style.overflow = "hidden";
    const f = feuilleRef.current;
    if (f && reprise) {
      // déjà positionnée par useLayoutEffect
    } else if (f) {
      f.style.overflowY = "hidden";
      f.style.transition = "none";
      f.style.transform = `translateY(${hauteurRef.current}px)`;
      f.getBoundingClientRect(); // force le point de départ avant d'animer
      requestAnimationFrame(() => {
        f.style.transition = "";
        if (depart === "plein") aller("plein");
        else { f.style.transform = `translateY(${hauteurRef.current * (1 - PEEK)}px)`; relais = { etat: "peek", quand: Date.now() }; }
      });
    }
    const esc = (e) => e.key === "Escape" && aller("ferme");
    document.addEventListener("keydown", esc);
    return () => {
      vivantes = Math.max(0, vivantes - 1);
      document.body.style.overflow = "";
      document.removeEventListener("keydown", esc);
      // on laisse la position à la feuille qui prend le relais ; une fermeture ne se transmet pas
      relais = { etat: etatRef.current === "ferme" ? null : etatRef.current, quand: Date.now() };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const prise = priseRef.current;
    const f = feuilleRef.current;
    if (!prise || !f) return;
    let y0 = 0, depart = 0, dernierY = 0, dernierT = 0, vitesse = 0, tient = false;

    const descendre = (e) => {
      // en plein écran, tout défile normalement — le geste de fermeture ne
      // reprend qu'en repartant de l'aperçu (bouton croix sinon)
      if (etat === "plein") return;
      tient = true;
      y0 = e.clientY;
      dernierY = e.clientY;
      dernierT = performance.now();
      vitesse = 0;
      depart = positionPour(etat);
      f.style.transition = "none";
      majPoignee(true);
      prise.setPointerCapture(e.pointerId);
    };
    const bouger = (e) => {
      if (!tient) return;
      const maintenant = performance.now();
      const dt = maintenant - dernierT;
      if (dt > 0) vitesse = (e.clientY - dernierY) / dt; // px/ms
      dernierY = e.clientY;
      dernierT = maintenant;
      const dy = e.clientY - y0;
      const h = hauteurRef.current;
      f.style.transform = `translateY(${Math.max(0, Math.min(h, depart + dy))}px)`;
    };
    const lacher = (e) => {
      if (!tient) return;
      tient = false;
      f.style.transition = "";
      const h = hauteurRef.current;
      const decalagePeek = h * (1 - PEEK); // distance depuis le haut à l'aperçu
      const actuel = depart + (e.clientY - y0);
      // un geste rapide (élan) l'emporte sur la seule position au lâcher
      if (vitesse > 0.5) { aller("ferme"); return; }
      if (vitesse < -0.5) { aller("plein"); return; }
      if (actuel > h * 0.75) aller("ferme");
      else if (actuel < decalagePeek * 0.5) aller("plein");
      else aller(actuel < decalagePeek ? "plein" : "peek");
    };
    prise.addEventListener("pointerdown", descendre);
    prise.addEventListener("pointermove", bouger);
    prise.addEventListener("pointerup", lacher);
    prise.addEventListener("pointercancel", lacher);
    return () => {
      prise.removeEventListener("pointerdown", descendre);
      prise.removeEventListener("pointermove", bouger);
      prise.removeEventListener("pointerup", lacher);
      prise.removeEventListener("pointercancel", lacher);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etat]);

  return (
    <div className={`fg-scrim${reprise ? " sans-fondu" : ""}`} onClick={() => aller("ferme")} role="presentation">
      <div
        ref={feuilleRef}
        className="fg-feuille"
        data-etat={etat}
        style={reprise ? { transition: "none", transform: `translateY(${reprise === "plein" ? 0 : window.innerHeight * (1 - PEEK)}px)` } : undefined}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div ref={priseRef} className="fg-prise">
          <div ref={poigneeRef} className="fg-poignee"><i /></div>
          {tete}
        </div>
        {!sansFermer && (
          <button type="button" className="fg-fermer"
            aria-label={etat === "plein" ? "Retour" : "Fermer"} onClick={() => aller("ferme")}>
            <X size={20} aria-hidden className={`fg-icone${etat === "plein" ? " cachee" : ""}`} />
            <ArrowLeft size={20} aria-hidden className={`fg-icone${etat === "plein" ? "" : " cachee"}`} />
          </button>
        )}
        <div className="fg-contenu">
          {children}
        </div>
      </div>
    </div>
  );
}
