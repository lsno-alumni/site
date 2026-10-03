"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { useReessai, BoutonReessayer } from "@/components/MediaRobuste";

// Lecteur de message vocal, dessiné avec les couleurs de la bulle (le
// lecteur natif du navigateur est un bloc blanc qui jure dans les bulles).
//
// La durée : un vocal enregistré dans le navigateur (webm) ne la contient pas.
// Depuis la migration 77, elle est mesurée à l'envoi et arrive par `duree` :
// on l'affiche telle quelle et la barre s'y rapporte, sans rien deviner. Pour
// les anciens vocaux sans durée, on la devine en sautant à la fin du fichier,
// et on écarte un résultat absurde (horodatages décalés dans le fichier : un
// vocal de 24 s se présentait comme 27:58 et ne se lisait plus).
const mmss = (s) => (Number.isFinite(s) && s >= 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");
const DUREE_MAX_PLAUSIBLE = 15 * 60;   // au-delà, la durée devinée est fausse

export default function LecteurAudio({ src, mienne = false, duree: dureeConnue = null }) {
  const audio = useRef(null);
  const [joue, setJoue] = useState(false);
  const [temps, setTemps] = useState(0);
  const [dureeLue, setDureeLue] = useState(0);
  const [vitesse, setVitesse] = useState(1);
  const { cle, srcAffiche, echec, surErreur, reessayer } = useReessai(src);
  const connue = Number.isFinite(dureeConnue) && dureeConnue > 0;
  const duree = connue ? dureeConnue : dureeLue;
  const changerVitesse = (e) => {
    e.stopPropagation();
    const v = vitesse === 1 ? 1.5 : vitesse === 1.5 ? 2 : 1;
    setVitesse(v);
    if (audio.current) audio.current.playbackRate = v;
  };
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const plausible = (d) => Number.isFinite(d) && d > 0 && d <= DUREE_MAX_PLAUSIBLE;
    const maj = () => { if (Number.isFinite(a.currentTime) && a.currentTime < 1e6) setTemps(a.currentTime); };
    const meta = () => {
      if (connue) return;   // rien à deviner
      if (plausible(a.duration)) setDureeLue(a.duration);
      else if (a.duration === Infinity && !a.dataset.sonde) { a.dataset.sonde = "1"; a.currentTime = 1e101; }
    };
    const dureeChangee = () => {
      if (connue) return;
      if (Number.isFinite(a.duration)) {
        if (plausible(a.duration)) setDureeLue(a.duration);
        if (a.dataset.sonde === "1") { a.dataset.sonde = "2"; a.currentTime = 0; setTemps(0); }
      }
    };
    const fin = () => { setJoue(false); setTemps(0); };
    const pause = () => setJoue(false);
    a.addEventListener("timeupdate", maj); a.addEventListener("loadedmetadata", meta); a.addEventListener("durationchange", dureeChangee); a.addEventListener("ended", fin); a.addEventListener("pause", pause);
    return () => { a.removeEventListener("timeupdate", maj); a.removeEventListener("loadedmetadata", meta); a.removeEventListener("durationchange", dureeChangee); a.removeEventListener("ended", fin); a.removeEventListener("pause", pause); };
  }, [cle, connue]);   // la balise est recréée à chaque tentative : on rebranche les écouteurs
  const basculer = (e) => {
    e.stopPropagation();
    const a = audio.current;
    if (!a) return;
    if (joue) { a.pause(); setJoue(false); }
    else { a.play().then(() => setJoue(true)).catch(() => {}); }
  };
  const chercher = (e) => {
    e.stopPropagation();
    const a = audio.current;
    if (!a || !duree) return;
    const r = e.currentTarget.getBoundingClientRect();
    const cible = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duree;
    a.currentTime = Math.min(cible, Math.max(0, duree - 0.25));
    setTemps(a.currentTime);
  };
  const part = duree ? Math.min(100, (temps / duree) * 100) : 0;
  if (echec) return <div className={`lecteur-audio${mienne ? " mienne" : ""} echec`}><BoutonReessayer onClick={reessayer} /></div>;
  return (
    <div className={`lecteur-audio${mienne ? " mien" : ""}`}>
      <audio key={cle} onError={surErreur} ref={audio} src={srcAffiche} preload="metadata" />
      <button type="button" className="lecteur-audio-bouton" onClick={basculer} aria-label={joue ? "Pause" : "Écouter"}>
        {joue ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden style={{ marginLeft: 2 }} />}
      </button>
      <div className="lecteur-audio-piste" onClick={chercher} role="slider" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(part)} aria-label="Position">
        <div className="lecteur-audio-fait" style={{ width: `${part}%` }} />
        <div className="lecteur-audio-curseur" style={{ left: `${part}%` }} />
      </div>
      <span className="lecteur-audio-temps">{joue || temps > 0 ? mmss(temps) : duree ? mmss(duree) : "vocal"}</span>
      <button type="button" className="lecteur-audio-vitesse" onClick={changerVitesse} aria-label={`Vitesse ${vitesse}×`}>{vitesse === 1 ? "1×" : vitesse === 1.5 ? "1,5×" : "2×"}</button>
    </div>
  );
}
