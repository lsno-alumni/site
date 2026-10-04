"use client";

import { useState } from "react";
import { ThumbsUp } from "lucide-react";
import { basculerBravo } from "@/lib/fil";
import * as memoire from "@/lib/memoire";

// Le « bravo » : un tap ajoute ou retire, le compteur suit tout de suite, la
// base confirme derrière (et corrige si elle n'est pas d'accord). Quand la
// carte reçoit des compteurs frais (rafraîchissement discret du Fil), le
// bouton les adopte.
export default function Bravo({ type, id, nombre = 0, actif = false, className = "pub-action" }) {
  const [on, setOn] = useState(actif);
  const [n, setN] = useState(nombre);
  const [attente, setAttente] = useState(false);
  const [recu, setRecu] = useState({ nombre, actif });
  if (!attente && (recu.nombre !== nombre || recu.actif !== actif)) {
    setRecu({ nombre, actif }); setN(nombre); setOn(actif);
  }
  const tap = async () => {
    if (attente) return;
    const avant = { on, n };
    setOn(!on); setN(n + (on ? -1 : 1)); setAttente(true);
    try { const total = await basculerBravo(type, id); setN(total); memoire.ecrire("fil.items", null); }
    catch { setOn(avant.on); setN(avant.n); }
    setAttente(false);
  };
  return (
    <button type="button" className={`${className}${on ? " on" : ""}`} onClick={tap} aria-pressed={on}>
      <ThumbsUp size={16} strokeWidth={on ? 2.4 : 1.9} aria-hidden /> Bravo{n > 0 && <b>{n}</b>}
    </button>
  );
}
