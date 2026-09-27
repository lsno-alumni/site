"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import * as memoire from "@/lib/memoire";
import { chargerRail } from "@/lib/moments";
import LecteurMoments from "@/app/fil/LecteurMoments";
import NouveauMoment from "@/app/fil/NouveauMoment";
import MesMoments from "@/app/fil/MesMoments";

// Le rail des moments en haut du Fil : mon rond d'abord (avec le « + »),
// puis les personnes qui ont du nouveau (anneau bleu), puis les autres
// (anneau gris). Un tap ouvre le lecteur plein écran ; « ?moment=ID » dans
// l'adresse ouvre directement ce moment (lien d'une notification de bravo).
export default function RailMoments({ moi, moderateur }) {
  const [rail, setRail] = useState(() => memoire.lire("fil.rail") ?? null);
  const [lecture, setLecture] = useState(null);    // { ia, im }
  const [creation, setCreation] = useState(false);
  const [suivi, setSuivi] = useState(false);       // panneau « Mes moments »

  const charger = async () => {
    try { const r = await chargerRail(); setRail(r); memoire.ecrire("fil.rail", r); } catch { /* le rail reste tel quel */ }
  };
  useEffect(() => {
    const t = setTimeout(charger, 0);   // hors du rendu (règle react-hooks/set-state-in-effect)
    const sur = () => charger();
    window.addEventListener("lsno:rafraichir", sur);
    window.addEventListener("lsno:moments", sur);
    return () => { clearTimeout(t); window.removeEventListener("lsno:rafraichir", sur); window.removeEventListener("lsno:moments", sur); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // ouverture directe par l'adresse
  useEffect(() => {
    if (!rail || lecture) return;
    const id = new URLSearchParams(window.location.search).get("moment");
    if (!id) return;
    const ia = rail.findIndex((a) => a.moments.some((m) => String(m.id) === id));
    if (ia >= 0) {
      const im = rail[ia].moments.findIndex((m) => String(m.id) === id);
      window.history.replaceState(null, "", window.location.pathname);
      setTimeout(() => setLecture({ ia, im }), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rail]);

  const liste = rail ?? [];
  const iaMoi = liste.findIndex((a) => a.auteur.id === moi.id);
  const mienne = iaMoi >= 0 ? liste[iaMoi] : null;
  const autres = liste.map((a, ia) => ({ a, ia })).filter(({ ia }) => ia !== iaMoi);
  const initiales = (moi.prenom[0] + (moi.nom?.[0] || "")).toUpperCase();

  return (
    <>
      <div className="rail" role="list" aria-label="Moments">
        <div className="rail-item" role="listitem">
          <button type="button" className={`rail-cercle moi${mienne ? (mienne.tout_vu ? " vu" : " nouveau") : ""}`}
            onClick={() => (mienne ? setSuivi(true) : setCreation(true))} aria-label={mienne ? "Mes moments" : "Publier un moment"}>
            {moi.photo ? <img src={moi.photo} alt="" /> : <span className="rail-init">{initiales}</span>}
            <span className="rail-plus" role="button" tabIndex={0} aria-label="Publier un moment"
              onClick={(e) => { e.stopPropagation(); setCreation(true); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setCreation(true); } }}>
              <Plus size={13} strokeWidth={3} aria-hidden />
            </span>
          </button>
          <span className="rail-nom">{mienne ? "Toi" : "Ajouter"}</span>
        </div>
        {autres.map(({ a, ia }) => (
          <div key={a.auteur.id} className="rail-item" role="listitem">
            <button type="button" className={`rail-cercle${a.tout_vu ? " vu" : " nouveau"}`} onClick={() => setLecture({ ia, im: a.tout_vu ? 0 : Math.max(0, a.moments.findIndex((m) => !m.vu)) })}
              aria-label={`Moments de ${a.auteur.prenom} ${a.auteur.nom}${a.tout_vu ? "" : ", nouveaux"}`}>
              {a.auteur.photo_url ? <img src={a.auteur.photo_url} alt="" /> : <span className="rail-init">{(a.auteur.prenom[0] + (a.auteur.nom?.[0] || "")).toUpperCase()}</span>}
              {a.moments.length > 1 && <span className="rail-nombre" aria-hidden>{a.moments.length}</span>}
            </button>
            <span className="rail-nom">{a.auteur.prenom}</span>
          </div>
        ))}
        {rail !== null && autres.length === 0 && (
          <p className="rail-vide">Personne n’a encore partagé de moment. Sois la première ou le premier.</p>
        )}
      </div>

      {lecture && rail && (
        <LecteurMoments auteurs={rail} departAuteur={lecture.ia} departMoment={lecture.im} moi={moi} moderateur={moderateur}
          onFermer={() => { setLecture(null); charger(); }} onChange={charger} />
      )}
      {suivi && (
        <MesMoments entree={mienne} onFermer={() => setSuivi(false)} onChange={charger}
          onVoir={(im) => { setSuivi(false); setLecture({ ia: iaMoi, im }); }}
          onNouveau={() => { setSuivi(false); setCreation(true); }} />
      )}
      {creation && (
        <NouveauMoment moi={moi} onFermer={() => setCreation(false)}
          onPublie={() => { setCreation(false); charger(); window.dispatchEvent(new CustomEvent("lsno:moments")); }} />
      )}
    </>
  );
}
