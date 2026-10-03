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
//
// Deux moteurs : la balise <audio> d'abord ; si le fichier est bien arrivé
// mais que le navigateur refuse de le lire (webm de Firefox dans Chrome :
// « demuxer seek failed », 03/10 — l'erreur ne tombe qu'au moment de lire),
// on le décode nous-mêmes avec Web Audio, qui y arrive, et on le joue depuis
// la mémoire : même lecteur, même barre. Le tap sur « Écouter » est retenu :
// la lecture démarre d'elle-même dès qu'un moteur est prêt, sans retaper.
const mmss = (s) => (Number.isFinite(s) && s >= 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");
const DUREE_MAX_PLAUSIBLE = 15 * 60;   // au-delà, la durée devinée est fausse

export default function LecteurAudio({ src, mienne = false, duree: dureeConnue = null }) {
  const audio = useRef(null);
  const [joue, setJoue] = useState(false);
  const [temps, setTemps] = useState(0);
  const [dureeLue, setDureeLue] = useState(0);
  const [vitesse, setVitesse] = useState(1);
  const { cle, srcAffiche, echec, illisible, surErreur, reessayer } = useReessai(src);
  const connue = Number.isFinite(dureeConnue) && dureeConnue > 0;
  const duree = connue ? dureeConnue : dureeLue;
  const veutJouer = useRef(false);   // « Écouter » tapé : on démarre dès qu'un moteur est prêt

  // --- moteur de secours (Web Audio) -------------------------------------
  // "non" : pas (encore) utilisé — en cours de décodage si le fichier est illisible ; "pret" ; "echec"
  const [secours, setSecours] = useState("non");
  const wa = useRef({ ctx: null, tampon: null, source: null, depart: 0, decalage: 0, boucle: 0, arret: false, lance: false });
  const positionWA = () => { const w = wa.current; return w.source ? Math.min(w.decalage + (w.ctx.currentTime - w.depart) * vitesse, w.tampon.duration) : w.decalage; };
  const arreterWA = () => {
    const w = wa.current;
    cancelAnimationFrame(w.boucle);
    if (w.source) { w.arret = true; try { w.source.stop(); } catch { /* déjà arrêté */ } w.source.disconnect(); w.source = null; }
  };
  const pauserWA = () => { const w = wa.current; w.decalage = positionWA(); arreterWA(); setJoue(false); setTemps(w.decalage); };
  const jouerWA = (depuis = null) => {
    const w = wa.current;
    if (!w.tampon) return;
    arreterWA();
    if (depuis !== null) w.decalage = depuis;
    if (w.decalage >= w.tampon.duration - 0.05) w.decalage = 0;
    if (w.ctx.state === "suspended") w.ctx.resume().catch(() => {});
    const source = w.ctx.createBufferSource();
    source.buffer = w.tampon; source.playbackRate.value = vitesse; source.connect(w.ctx.destination);
    w.arret = false;
    // la fin d'une source REMPLACÉE (déplacement, reprise) arrive après coup : on l'ignore
    source.onended = () => { if (w.arret || w.source !== source) return; w.source = null; w.decalage = 0; setJoue(false); setTemps(0); cancelAnimationFrame(w.boucle); };
    w.depart = w.ctx.currentTime; w.source = source;
    source.start(0, w.decalage);
    setJoue(true);
    const tic = () => { setTemps(positionWA()); w.boucle = requestAnimationFrame(tic); };
    w.boucle = requestAnimationFrame(tic);
  };
  useEffect(() => {
    if (!(echec && illisible) || wa.current.lance) return;
    wa.current.lance = true;
    let vivant = true;
    (async () => {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) throw new Error("pas de Web Audio");
        // le fichier déjà reçu (adresse blob:) d'abord — sans options, le mode
        // CORS étant refusé pour ce schéma — sinon on le redemande au réseau
        const brut = await (srcAffiche !== src ? fetch(srcAffiche) : fetch(src, { mode: "cors", credentials: "omit" }))
          .catch(() => fetch(src, { mode: "cors", credentials: "omit" }))
          .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); });
        const ctx = wa.current.ctx ?? new Ctx();
        const tampon = await new Promise((ok, ko) => { const p = ctx.decodeAudioData(brut, ok, ko); if (p?.then) p.then(ok, ko); });
        if (!vivant) return;
        wa.current.ctx = ctx; wa.current.tampon = tampon;
        if (!connue) setDureeLue(tampon.duration);
        setSecours("pret");
      } catch { if (vivant) setSecours("echec"); }
    })();
    return () => { vivant = false; };
  }, [echec, illisible, src, srcAffiche, connue]);
  useEffect(() => { if (secours === "pret" && veutJouer.current) jouerWA(); }, [secours]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { arreterWA(); wa.current.ctx?.close?.().catch?.(() => {}); }, []);

  // --- moteur normal (<audio>) ------------------------------------------
  const changerVitesse = (e) => {
    e.stopPropagation();
    const v = vitesse === 1 ? 1.5 : vitesse === 1.5 ? 2 : 1;
    setVitesse(v);
    if (audio.current) audio.current.playbackRate = v;
    if (secours === "pret" && wa.current.source) { const pos = positionWA(); wa.current.decalage = pos; wa.current.depart = wa.current.ctx.currentTime; wa.current.source.playbackRate.value = v; }
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
    // une balise recréée (nouvelle tentative) reprend la lecture demandée
    const pret = () => { if (veutJouer.current && a.paused) a.play().then(() => setJoue(true)).catch(() => {}); };
    const fin = () => { veutJouer.current = false; setJoue(false); setTemps(0); };
    const pause = () => setJoue(false);
    a.addEventListener("timeupdate", maj); a.addEventListener("loadedmetadata", meta); a.addEventListener("durationchange", dureeChangee); a.addEventListener("canplay", pret); a.addEventListener("ended", fin); a.addEventListener("pause", pause);
    return () => { a.removeEventListener("timeupdate", maj); a.removeEventListener("loadedmetadata", meta); a.removeEventListener("durationchange", dureeChangee); a.removeEventListener("canplay", pret); a.removeEventListener("ended", fin); a.removeEventListener("pause", pause); };
  }, [cle, connue, secours]);   // la balise est recréée à chaque tentative : on rebranche les écouteurs

  const basculer = (e) => {
    e.stopPropagation();
    if (secours === "pret") { if (joue) pauserWA(); else jouerWA(); return; }
    const a = audio.current;
    if (!a) return;
    if (joue) { veutJouer.current = false; a.pause(); setJoue(false); }
    else { veutJouer.current = true; a.play().then(() => setJoue(true)).catch(() => {}); }
  };
  const chercher = (e) => {
    e.stopPropagation();
    if (!duree) return;
    const r = e.currentTarget.getBoundingClientRect();
    const cible = Math.min(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duree, Math.max(0, duree - 0.25));
    if (secours === "pret") { if (joue) jouerWA(cible); else { wa.current.decalage = cible; setTemps(cible); } return; }
    const a = audio.current;
    if (!a) return;
    a.currentTime = cible;
    setTemps(a.currentTime);
  };
  const part = duree ? Math.min(100, (temps / duree) * 100) : 0;
  const classe = `lecteur-audio${mienne ? " mien" : ""}`;
  if (echec && secours !== "pret") {
    if (illisible && secours === "non") return <div className={`${classe} echec`}><span className="lecteur-audio-illisible">Décodage du vocal…</span></div>;
    if (illisible) return <div className={`${classe} echec`}><span className="lecteur-audio-illisible">Vocal illisible sur cet appareil</span><BoutonReessayer onClick={reessayer} /></div>;
    return <div className={`${classe} echec`}><BoutonReessayer onClick={reessayer} /></div>;
  }
  return (
    <div className={classe}>
      {secours !== "pret" && <audio key={cle} onError={surErreur} ref={audio} src={srcAffiche} preload="metadata" />}
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
