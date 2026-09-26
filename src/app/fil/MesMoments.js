"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Eye, ThumbsUp, Trash2, Play } from "lucide-react";
import { depuis, VISIBILITES } from "@/lib/fil";
import { supprimerMoment, expireDans } from "@/lib/moments";

// « Mes moments » : le suivi de ce que j'ai publié — vignette, légende,
// depuis quand, jusqu'à quand, qui a vu (nombre), bravos. Un tap ouvre le
// lecteur sur ce moment ; la corbeille le supprime tout de suite.
export default function MesMoments({ entree, onVoir, onNouveau, onFermer, onChange }) {
  const [suppr, setSuppr] = useState(null);
  const moments = entree?.moments ?? [];
  useEffect(() => {
    const touche = (e) => { if (e.key === "Escape") onFermer(); };
    document.addEventListener("keydown", touche);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", touche); document.body.style.overflow = overflow; };
  }, [onFermer]);

  const supprimer = async (m) => {
    if (!confirm("Supprimer ce moment ?")) return;
    setSuppr(m.id);
    try { await supprimerMoment(m); await onChange?.(); } catch { /* le panneau reste */ }
    setSuppr(null);
  };

  return createPortal(
    <div className="fg-scrim msg-voile" role="presentation" onClick={onFermer}>
      <div className="msg-panneau mm-panneau" role="dialog" aria-modal="true" aria-label="Mes moments" onClick={(e) => e.stopPropagation()}>
        <div className="msg-panneau-tete">
          <b>Mes moments</b>
          <button type="button" className="cp-fermer" onClick={onFermer} aria-label="Fermer"><X size={18} aria-hidden /></button>
        </div>
        <button type="button" className="mm-nouveau" onClick={onNouveau}>
          <span className="mm-nouveau-rond"><Plus size={18} strokeWidth={2.5} aria-hidden /></span>
          <span><b>Nouveau moment</b><small>Une photo ou une vidéo, visible 24 h, 3 jours ou 7 jours</small></span>
        </button>
        {moments.length === 0 && <p className="msg-aide" style={{ padding: "6px 10px 12px" }}>Aucun moment en cours. Ceux qui expirent disparaissent d’eux-mêmes.</p>}
        {moments.map((m, im) => {
          const visi = VISIBILITES.find((v) => v.cle === m.visibilite);
          return (
            <div key={m.id} className={`mm-ligne${suppr === m.id ? " off" : ""}`}>
              <button type="button" className="mm-voir" onClick={() => onVoir(im)} aria-label="Voir ce moment">
                <span className="mm-vignette">
                  {m.media_type === "photo" ? <img src={m.url} alt="" /> : <><video src={m.url} muted preload="metadata" playsInline /><Play size={14} aria-hidden className="mm-lire" /></>}
                </span>
                <span className="mm-texte">
                  <b>{m.legende || (m.media_type === "video" ? "Vidéo sans légende" : "Photo sans légende")}</b>
                  <small>{depuis(m.cree_le)} · {expireDans(m.expire_le)}{visi && visi.cle !== "tous" ? ` · ${visi.court}` : ""}{m.masque ? " · masqué par la modération" : ""}</small>
                  <small className="mm-compteurs"><Eye size={13} aria-hidden /> {m.vues ?? 0} vue{(m.vues ?? 0) > 1 ? "s" : ""} <ThumbsUp size={13} aria-hidden style={{ marginLeft: 8 }} /> {m.bravos ?? 0}</small>
                </span>
              </button>
              <button type="button" className="mm-suppr" onClick={() => supprimer(m)} aria-label="Supprimer ce moment" disabled={suppr === m.id}><Trash2 size={16} aria-hidden /></button>
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  );
}
