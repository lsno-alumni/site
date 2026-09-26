"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

// Lecteur de message vocal, dessiné avec les couleurs de la bulle (le
// lecteur natif du navigateur est un bloc blanc qui jure dans les bulles).
const mmss = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");

export default function LecteurAudio({ src, mienne = false }) {
  const audio = useRef(null);
  const [joue, setJoue] = useState(false);
  const [temps, setTemps] = useState(0);
  const [duree, setDuree] = useState(0);
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const maj = () => setTemps(a.currentTime);
    const meta = () => setDuree(Number.isFinite(a.duration) ? a.duration : 0);
    const fin = () => { setJoue(false); setTemps(0); };
    a.addEventListener("timeupdate", maj); a.addEventListener("loadedmetadata", meta); a.addEventListener("durationchange", meta); a.addEventListener("ended", fin);
    return () => { a.removeEventListener("timeupdate", maj); a.removeEventListener("loadedmetadata", meta); a.removeEventListener("durationchange", meta); a.removeEventListener("ended", fin); };
  }, [src]);
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
    a.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duree;
  };
  const part = duree ? Math.min(100, (temps / duree) * 100) : 0;
  return (
    <div className={`lecteur-audio${mienne ? " mien" : ""}`}>
      <audio ref={audio} src={src} preload="metadata" />
      <button type="button" className="lecteur-audio-bouton" onClick={basculer} aria-label={joue ? "Pause" : "Écouter"}>
        {joue ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden style={{ marginLeft: 2 }} />}
      </button>
      <div className="lecteur-audio-piste" onClick={chercher} role="slider" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(part)} aria-label="Position">
        <div className="lecteur-audio-fait" style={{ width: `${part}%` }} />
        <div className="lecteur-audio-curseur" style={{ left: `${part}%` }} />
      </div>
      <span className="lecteur-audio-temps">{joue || temps > 0 ? mmss(temps) : mmss(duree)}</span>
    </div>
  );
}
