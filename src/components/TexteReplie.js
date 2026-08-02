"use client";

import { useEffect, useRef, useState } from "react";

// Replie un texte long derrière « Lire la suite », et le redéplie.
//
// ⚠ Le bouton n'apparaît QUE si le texte déborde RÉELLEMENT — on le mesure après
// le rendu (scrollHeight > clientHeight) au lieu de le deviner à partir d'un
// nombre de caractères. La même phrase tient sur 3 lignes à 420 px et en occupe
// 5 à 340 px : compter les caractères affiche « Lire la suite » sur un texte
// déjà entier, ou l'oublie là où il manque.
//
// Mesuré aussi à chaque changement de largeur (rotation de l'écran) et une fois
// les polices chargées — le serif du site est plus large que la police de
// remplacement, un texte qui tenait avant peut déborder après.

export default function TexteReplie({
  children,
  lignes = 4,
  plus = "Lire la suite",
  moins = "Réduire",
  className = "",
}) {
  const ref = useRef(null);
  const [deborde, setDeborde] = useState(false);
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const mesurer = () => {
      // Ouvert, le texte ne déborde plus par construction : mesurer ici ferait
      // disparaître le bouton « Réduire ».
      if (ouvert) return;
      // ⚠ On mesure TOUJOURS dans l'état fidèle (sauts de ligne de l'auteur
      // conservés), même quand l'aperçu est en cours d'affichage en version
      // dense — voir la classe « coupe » plus bas. Sans cette précaution la
      // mesure porterait tantôt sur un texte aéré, tantôt sur un texte dense,
      // et les deux réponses s'appelleraient l'une l'autre sans fin.
      // Lire scrollHeight entre les deux lignes force le calcul : aucun
      // affichage intermédiaire n'est peint.
      const dense = el.classList.contains("coupe");
      if (dense) el.classList.remove("coupe");
      const trop = el.scrollHeight > el.clientHeight + 1;
      if (dense) el.classList.add("coupe");
      setDeborde(trop);
    };

    mesurer();
    const ro = new ResizeObserver(mesurer);
    ro.observe(el);
    document.fonts?.ready.then(mesurer).catch(() => {});
    return () => ro.disconnect();
  }, [children, lignes, ouvert]);

  // « coupe » = aperçu tronqué : on y ignore les sauts de ligne de l'auteur,
  // sinon une ligne vide entre deux paragraphes mange une ligne de l'aperçu et
  // les points de suspension se retrouvent seuls sur la leur. Un texte qui tient
  // en entier n'est pas concerné : sa mise en forme reste intacte.
  const classes = ["texte-replie"];
  if (ouvert) classes.push("ouvert");
  else if (deborde) classes.push("coupe");
  if (className) classes.push(className);

  return (
    <>
      <p ref={ref} className={classes.join(" ")} style={{ WebkitLineClamp: lignes }}>
        {children}
      </p>
      {deborde && (
        <button type="button" className="lire-suite"
          aria-expanded={ouvert}
          onClick={() => setOuvert((v) => !v)}>
          {ouvert ? moins : plus}
        </button>
      )}
    </>
  );
}
