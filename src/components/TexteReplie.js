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
    // Ouvert, le texte ne déborde plus par construction : mesurer ici ferait
    // disparaître le bouton « Réduire ». On ne mesure donc que replié.
    const mesurer = () => {
      if (ouvert) return;
      setDeborde(el.scrollHeight > el.clientHeight + 1);
    };
    mesurer();
    const ro = new ResizeObserver(mesurer);
    ro.observe(el);
    document.fonts?.ready.then(mesurer).catch(() => {});
    return () => ro.disconnect();
  }, [children, lignes, ouvert]);

  return (
    <>
      <p
        ref={ref}
        className={`texte-replie${ouvert ? " ouvert" : ""}${className ? " " + className : ""}`}
        style={{ WebkitLineClamp: lignes }}
      >
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
