"use client";

import { useEffect, useState } from "react";
import { texteErreur } from "@/lib/erreurs";
import { createPortal } from "react-dom";
import { X, Plus, Eye, Trash2, Play, BookmarkPlus } from "lucide-react";
import { depuis, VISIBILITES } from "@/lib/fil";
import { supprimerMoment, garderEnPublication, expireDans, resumeReactions } from "@/lib/moments";

// « Mes moments » : le suivi de ce que j'ai publié — vignette, légende,
// depuis quand, jusqu'à quand, qui a vu (nombre), bravos. Un tap ouvre le
// lecteur sur ce moment ; la corbeille le supprime tout de suite.
export default function MesMoments({ entree, onVoir, onNouveau, onFermer, onChange }) {
  const [suppr, setSuppr] = useState(null);
  const [garde, setGarde] = useState(null);     // id en cours de copie vers le Fil
  const [toast, setToast] = useState("");
  const moments = entree?.moments ?? [];
  const signale = (t) => { setToast(t); setTimeout(() => setToast(""), 2600); };
  useEffect(() => {
    const touche = (e) => { if (e.key === "Escape") onFermer(); };
    document.addEventListener("keydown", touche);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", touche); document.body.style.overflow = overflow; };
  }, [onFermer]);

  const garder = async (m) => {
    setGarde(m.id);
    try { await garderEnPublication(m); signale("Publié dans le Fil, pour de bon."); window.dispatchEvent(new CustomEvent("lsno:rafraichir")); }
    catch (e) { signale("Impossible : " + texteErreur(e)); }
    setGarde(null);
  };
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
        {moments.length > 0 && <p className="mm-aide">Le signet garde un moment pour de bon : il devient une publication du Fil.</p>}
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
                  <small className="mm-compteurs"><Eye size={13} aria-hidden /> {m.vues ?? 0} vue{(m.vues ?? 0) > 1 ? "s" : ""}{resumeReactions(m.reactions) ? <span className="mm-reactions">{resumeReactions(m.reactions)}</span> : null}</small>
                </span>
              </button>
              <button type="button" className="mm-suppr mm-garder" onClick={() => garder(m)} aria-label="Garder en publication" title="Garder en publication" disabled={garde === m.id}><BookmarkPlus size={17} aria-hidden /></button>
              <button type="button" className="mm-suppr" onClick={() => supprimer(m)} aria-label="Supprimer ce moment" disabled={suppr === m.id}><Trash2 size={16} aria-hidden /></button>
            </div>
          );
        })}
      </div>
      {toast && <div className="toast la mo-toast" role="status">{toast}</div>}
    </div>,
    document.body
  );
}
