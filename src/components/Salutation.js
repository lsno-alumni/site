"use client";

import { useEffect, useState } from "react";

// « Bonjour » ou « Bonsoir » selon l'heure LOCALE de l'appareil du membre
// (rendu côté client — le serveur ne connaît pas son fuseau).
export default function Salutation({ prenom }) {
  const [mot, setMot] = useState("Bonjour");
  useEffect(() => {
    const h = new Date().getHours();
    setMot(h >= 5 && h < 18 ? "Bonjour" : "Bonsoir");
  }, []);
  return <>{mot}, <em>{prenom}</em> 👋</>;
}
