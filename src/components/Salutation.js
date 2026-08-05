"use client";

import { useEffect, useState } from "react";

// « Bonjour » ou « Bonsoir » selon l'heure LOCALE de l'appareil du membre
// (rendu côté client — le serveur ne connaît pas son fuseau).
export default function Salutation({ prenom }) {
  const [mot, setMot] = useState("Bonjour");
  useEffect(() => {
    // l'heure LOCALE de l'appareil : le serveur ne la connaît pas (autre
    // fuseau), donc calculée après coup pour ne jamais dépendre du rendu
    // serveur — sinon « Bonsoir » chez le membre pourrait s'afficher
    // « Bonjour » un instant, le temps de l'hydratation.
    const h = new Date().getHours();
    setMot(h >= 5 && h < 18 ? "Bonjour" : "Bonsoir"); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);
  return <>{mot}, <em>{prenom}</em> 👋</>;
}
