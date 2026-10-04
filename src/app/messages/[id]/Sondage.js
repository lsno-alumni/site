"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { voter } from "@/lib/messages";

// Un sondage dans une bulle : la question, les choix avec leur barre et leur
// compte, mon vote surligné. Un tap vote (ou retire mon vote) ; à choix
// multiples, plusieurs cases. Les votes des autres arrivent en temps réel.
export default function Sondage({ sondage, votes, moiId, nomDe, onMaj }) {
  const [attente, setAttente] = useState(false);
  if (!sondage) return <p className="msg-piece-expiree">Sondage indisponible.</p>;
  const mien = votes.find((v) => v.membre === moiId)?.choix ?? [];
  const total = votes.length;
  const compte = (i) => votes.filter((v) => v.choix.includes(i)).length;
  const basculer = async (i) => {
    if (attente) return;
    let nouveau;
    if (sondage.multiple) nouveau = mien.includes(i) ? mien.filter((x) => x !== i) : [...mien, i];
    else nouveau = mien.includes(i) ? [] : [i];
    setAttente(true);
    try { await voter(sondage.id, nouveau); onMaj?.(nouveau); } catch { /* le temps réel corrigera */ }
    setAttente(false);
  };
  return (
    <div className="sondage">
      <b className="sondage-question">{sondage.question}</b>
      <small className="sondage-aide">{sondage.multiple ? "Plusieurs réponses possibles" : "Une seule réponse"} · {total} vote{total > 1 ? "s" : ""}</small>
      <div className="sondage-choix">
        {sondage.choix.map((c, i) => {
          const n = compte(i);
          const part = total ? Math.round((n / total) * 100) : 0;
          const on = mien.includes(i);
          const qui = votes.filter((v) => v.choix.includes(i)).map((v) => nomDe(v.membre)).join(", ");
          return (
            <button key={i} type="button" className={`sondage-option${on ? " on" : ""}`} onClick={() => basculer(i)} disabled={attente} title={qui} aria-pressed={on}>
              <span className="sondage-barre" style={{ width: `${part}%` }} aria-hidden />
              <span className="sondage-case" aria-hidden>{on && <Check size={12} strokeWidth={3} />}</span>
              <span className="sondage-texte">{c}</span>
              <span className="sondage-compte">{n}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
