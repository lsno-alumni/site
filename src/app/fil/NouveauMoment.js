"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Camera, Clapperboard, Globe2, Users, Briefcase, Clock } from "lucide-react";
import { VISIBILITES } from "@/lib/fil";
import { publierMoment, DUREES, DUREE_DEFAUT, LEGENDE_MAX, VIDEO_MO, VIDEO_SECONDES } from "@/lib/moments";

const ICONES_VISI = { tous: Globe2, promo: Users, domaine: Briefcase };

// Publier un moment : on choisit une photo ou une vidéo, on la voit en plein
// écran, on ajoute une légende, on choisit qui la voit et combien de temps
// elle reste, puis « Publier ». Un seul moment à la fois, on peut en
// enchaîner plusieurs.
export default function NouveauMoment({ moi, onFermer, onPublie }) {
  const [media, setMedia] = useState(null);   // { type, url, fichier, duree }
  const [legende, setLegende] = useState("");
  const [visibilite, setVisibilite] = useState("tous");
  const [duree, setDuree] = useState(DUREE_DEFAUT);
  const [souci, setSouci] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const fichierPhoto = useRef(null);
  const fichierVideo = useRef(null);

  const choisirPhoto = (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f || !f.type.startsWith("image/")) return;
    setSouci(""); setMedia({ type: "photo", url: URL.createObjectURL(f), fichier: f });
  };
  const choisirVideo = (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f || !f.type.startsWith("video/")) return;
    if (f.size > VIDEO_MO * 1024 * 1024) { setSouci(`Vidéo trop lourde (${Math.round(f.size / 1048576)} Mo). ${VIDEO_MO} Mo au maximum.`); return; }
    const url = URL.createObjectURL(f);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      if (v.duration > VIDEO_SECONDES + 0.5) { setSouci(`Vidéo trop longue (${Math.round(v.duration)} s). ${VIDEO_SECONDES} secondes au maximum.`); URL.revokeObjectURL(url); return; }
      setSouci(""); setMedia({ type: "video", url, duree: Math.round(v.duration), fichier: f });
    };
    v.onerror = () => { setSouci("Cette vidéo ne peut pas être lue ici."); URL.revokeObjectURL(url); };
    v.src = url;
  };
  const publier = async () => {
    if (!media || envoi) return;
    setEnvoi(true); setSouci("");
    try {
      await publierMoment({ fichier: media.fichier, type: media.type, legende, visibilite, duree });
      URL.revokeObjectURL(media.url);
      onPublie?.();
    } catch (e) { setSouci("Publication impossible : " + (e?.message ?? "réessaie dans un instant.")); setEnvoi(false); }
  };
  const nomCercle = (cle) => cle === "promo" && moi.promo ? `Promo ${moi.promo}` : cle === "domaine" && moi.domaine ? moi.domaine : VISIBILITES.find((v) => v.cle === cle).nom;

  return createPortal(
    <div className="mo-lecteur nm" role="dialog" aria-modal="true" aria-label="Nouveau moment">
      <header className="mo-tete nm-tete">
        <b className="nm-titre">Nouveau moment</b>
        <button type="button" className="mo-bouton" onClick={onFermer} aria-label="Annuler"><X size={22} aria-hidden /></button>
      </header>

      {!media ? (
        <div className="nm-choix">
          <p>Une photo ou une vidéo courte, qui disparaît d’elle-même.</p>
          <button type="button" className="nm-grand" onClick={() => fichierPhoto.current?.click()}><Camera size={26} strokeWidth={1.7} aria-hidden /> Une photo</button>
          <button type="button" className="nm-grand" onClick={() => fichierVideo.current?.click()}><Clapperboard size={26} strokeWidth={1.7} aria-hidden /> Une vidéo <small>{VIDEO_SECONDES} s, {VIDEO_MO} Mo au plus</small></button>
          {souci && <p className="cp-souci" role="alert">{souci}</p>}
        </div>
      ) : (
        <>
          <div className="mo-scene nm-scene">
            {media.type === "photo" ? <img src={media.url} alt="" draggable={false} /> : <video src={media.url} autoPlay muted loop playsInline />}
            <button type="button" className="nm-changer" onClick={() => { URL.revokeObjectURL(media.url); setMedia(null); }}>Changer</button>
          </div>
          <div className="nm-pied">
            <input className="nm-legende" type="text" value={legende} maxLength={LEGENDE_MAX} placeholder="Une légende ? (facultatif)" onChange={(e) => setLegende(e.target.value)} />
            <div className="nm-reglages">
              <div className="nm-groupe" role="radiogroup" aria-label="Qui peut voir ce moment">
                {VISIBILITES.map((v) => { const I = ICONES_VISI[v.cle]; return (
                  <button key={v.cle} type="button" role="radio" aria-checked={visibilite === v.cle} className={`puce nm-puce${visibilite === v.cle ? " active" : ""}`} onClick={() => setVisibilite(v.cle)}>
                    <I size={13} strokeWidth={2} aria-hidden /> {nomCercle(v.cle)}
                  </button>); })}
              </div>
              <div className="nm-groupe" role="radiogroup" aria-label="Combien de temps il reste visible">
                <Clock size={14} strokeWidth={2} aria-hidden className="nm-horloge" />
                {DUREES.map((d) => (
                  <button key={d.heures} type="button" role="radio" aria-checked={duree === d.heures} className={`puce nm-puce${duree === d.heures ? " active" : ""}`} onClick={() => setDuree(d.heures)} title={d.aide}>{d.nom}</button>
                ))}
              </div>
            </div>
            {souci && <p className="cp-souci" role="alert" style={{ margin: "8px 0 0" }}>{souci}</p>}
            <button type="button" className="btn btn-or nm-publier" onClick={publier} disabled={envoi}>{envoi ? "Envoi…" : "Publier le moment"}</button>
          </div>
        </>
      )}
      <input ref={fichierPhoto} type="file" accept="image/*" hidden onChange={choisirPhoto} />
      <input ref={fichierVideo} type="file" accept="video/*" hidden onChange={choisirVideo} />
    </div>,
    document.body
  );
}
