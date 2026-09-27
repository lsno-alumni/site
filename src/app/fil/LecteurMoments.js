"use client";

import { useEffect, useRef, useState } from "react";
import { texteErreur } from "@/lib/erreurs";
import { createPortal } from "react-dom";
import { X, MoreHorizontal, Eye, ChevronLeft, ChevronRight, Send } from "lucide-react";
import Avatar from "@/components/Avatar";
import useClicDehors from "@/lib/useClicDehors";
import { depuis, signaler, VISIBILITES } from "@/lib/fil";
import { TexteMentions } from "@/lib/mentions";
import { ouvrirDuo, envoyerMessage } from "@/lib/messages";
import { marquerVu, reagir, vuesDe, supprimerMoment, modererMoment, expireDans, resumeReactions, SECONDES_PHOTO, EMOJIS_MOMENT } from "@/lib/moments";

// Le lecteur plein écran : les moments d'une personne s'enchaînent (photo
// 5 s, vidéo jusqu'à sa fin), puis on passe à la personne suivante. Tap à
// droite = suivant, à gauche = précédent, doigt maintenu = pause, glisser
// vers le bas = fermer, glisser à gauche/droite = changer de personne.
// En bas : réponse rapide (part en message privé, sans quitter) et
// réactions rapides ; pour ses propres moments, les vues et les réactions.
export default function LecteurMoments({ auteurs, departAuteur = 0, departMoment = 0, moi, moderateur, onFermer, onChange }) {
  const [ia, setIa] = useState(departAuteur);
  const [im, setIm] = useState(departMoment);
  const [avancement, setAvancement] = useState(0);   // 0..1 du moment en cours
  const [pause, setPause] = useState(false);
  const [menu, setMenu] = useState(false);
  const [vues, setVues] = useState(null);            // liste « qui a vu » (auteur)
  const [reaction, setReaction] = useState(null);    // mon emoji sur le moment en cours
  const [reponse, setReponse] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [toast, setToast] = useState("");
  const [masques, setMasques] = useState({});        // id → masqué (modération faite ici)
  const dejaVus = useRef(new Set());                 // moments marqués vus pendant cette lecture
  const menuRef = useRef(null);
  const video = useRef(null);
  const geste = useRef(null);
  const debutPhoto = useRef(0);
  const ecoule = useRef(0);
  useClicDehors(menu, (e) => menuRef.current?.contains(e.target), () => setMenu(false));

  const auteur = auteurs[ia];
  const moments = auteur?.moments ?? [];
  const m = moments[im];
  const mien = auteur?.auteur.id === moi.id;
  const signale = (t) => { setToast(t); setTimeout(() => setToast(""), 2400); };

  // navigation
  const suivant = () => {
    if (im + 1 < moments.length) { setIm(im + 1); return; }
    if (ia + 1 < auteurs.length) { setIa(ia + 1); setIm(0); return; }
    onFermer();
  };
  const precedent = () => {
    if (im > 0) { setIm(im - 1); return; }
    if (ia > 0) { setIa(ia - 1); setIm(Math.max(0, (auteurs[ia - 1].moments?.length ?? 1) - 1)); return; }
    setAvancement(0); debutPhoto.current = performance.now(); ecoule.current = 0;
  };
  const autreAuteur = (d) => {
    const k = ia + d;
    if (k < 0 || k >= auteurs.length) { if (d > 0) onFermer(); return; }
    setIa(k); setIm(0);
  };

  // à chaque moment affiché : remise à zéro, marque « vu », ma réaction
  useEffect(() => {
    if (!m) { onFermer(); return; }
    debutPhoto.current = performance.now(); ecoule.current = 0;
    const r = requestAnimationFrame(() => {
      setAvancement(0); setPause(false); setMenu(false); setVues(null); setReponse("");
      setReaction(m.ma_reaction ?? null);
    });
    if (!mien && !m.vu && !dejaVus.current.has(m.id)) {
      dejaVus.current.add(m.id);
      marquerVu(m.id).then(() => { window.dispatchEvent(new CustomEvent("lsno:moments")); }).catch(() => {});
    }
    return () => cancelAnimationFrame(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ia, im]);

  // minuterie des photos (les vidéos avancent avec timeupdate)
  useEffect(() => {
    if (!m || m.media_type !== "photo") return;
    let vivant = true;
    const tic = () => {
      if (!vivant) return;
      if (!pause) {
        const t = ecoule.current + (performance.now() - debutPhoto.current) / 1000;
        if (t >= SECONDES_PHOTO) { suivant(); return; }
        setAvancement(t / SECONDES_PHOTO);
      }
      requestAnimationFrame(tic);
    };
    const r = requestAnimationFrame(tic);
    return () => { vivant = false; cancelAnimationFrame(r); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ia, im, pause]);

  // pause : on fige le temps écoulé ; reprise : on repart de là
  useEffect(() => {
    if (!m) return;
    if (m.media_type === "video") { if (pause) video.current?.pause(); else video.current?.play().catch(() => {}); return; }
    if (pause) ecoule.current += (performance.now() - debutPhoto.current) / 1000;
    else debutPhoto.current = performance.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pause]);

  // Échap, et la page derrière ne défile plus
  useEffect(() => {
    const touche = (e) => {
      if (e.target?.tagName === "INPUT") { if (e.key === "Escape") e.target.blur(); return; }
      if (e.key === "Escape") onFermer(); if (e.key === "ArrowRight") suivant(); if (e.key === "ArrowLeft") precedent();
    };
    document.addEventListener("keydown", touche);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", touche); document.body.style.overflow = overflow; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ia, im]);

  // gestes sur la scène
  const debut = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    geste.current = { x0: e.clientX, y0: e.clientY, t0: performance.now(), pause: false };
    geste.current.minuteur = setTimeout(() => { if (geste.current) { geste.current.pause = true; setPause(true); } }, 220);
  };
  const fin = (e) => {
    const g = geste.current; geste.current = null;
    if (!g) return;
    clearTimeout(g.minuteur);
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (g.pause) setPause(false);
    if (dy > 90 && Math.abs(dx) < 70) { onFermer(); return; }
    if (Math.abs(dx) > 70 && Math.abs(dy) < 60) { autreAuteur(dx < 0 ? 1 : -1); return; }
    if (!g.pause && Math.abs(dx) < 12 && Math.abs(dy) < 12) {
      const large = e.currentTarget.getBoundingClientRect().width;
      if (e.clientX < large * 0.3) precedent(); else suivant();
    }
  };

  const agir = async (action, arg) => {
    setMenu(false);
    try {
      if (action === "supprimer") {
        if (!confirm("Supprimer ce moment ?")) return;
        await supprimerMoment(m); signale("Moment supprimé"); onChange?.(); onFermer();
      }
      if (action === "signaler") { await signaler("moment", m.id, "Moment signalé depuis l'application"); signale("Merci, les modérateurs sont prévenus."); }
      if (action === "masquer") { const v = !estMasque; await modererMoment(m.id, v); setMasques((x) => ({ ...x, [m.id]: v })); signale(v ? "Moment masqué" : "Moment rétabli"); onChange?.(); }
      if (action === "reaction") {
        const nouvelle = await reagir(m.id, arg, reaction);
        setReaction(nouvelle);
        signale(nouvelle ? `Réaction ${nouvelle} envoyée` : "Réaction retirée");
        onChange?.();
      }
      if (action === "repondre") {
        const texte = reponse.trim();
        if (!texte || envoi) return;
        setEnvoi(true);
        const cid = await ouvrirDuo(auteur.auteur.id);
        await envoyerMessage(cid, texte, [], { chemin: `/fil?moment=${m.id}`, type: "lien", nom: `Moment de ${auteur.auteur.prenom}${m.legende ? ` · ${m.legende.slice(0, 60)}` : ""}`, taille: null });
        setReponse(""); setEnvoi(false); setPause(false);
        signale(`Envoyé à ${auteur.auteur.prenom} en message privé`);
      }
      if (action === "vues") { setPause(true); setVues("…"); setVues(await vuesDe(m.id)); }
    } catch (e) { setEnvoi(false); signale("Action impossible : " + texteErreur(e)); }
  };

  if (!m) return null;
  const visi = VISIBILITES.find((v) => v.cle === m.visibilite);
  const estMasque = masques[m.id] ?? m.masque;
  const resume = resumeReactions(m.reactions);
  return createPortal(
    <div className="mo-lecteur" role="dialog" aria-modal="true" aria-label={`Moment de ${auteur.auteur.prenom}`}>
      <div className="mo-barres" aria-hidden>
        {moments.map((x, k) => (
          <span key={x.id} className="mo-barre"><i style={{ width: k < im ? "100%" : k === im ? `${avancement * 100}%` : 0 }} /></span>
        ))}
      </div>
      <header className="mo-tete">
        <Avatar profil={{ prenom: auteur.auteur.prenom, nom: auteur.auteur.nom, photo: auteur.auteur.photo_url }} className="pub-avatar" />
        <span className="mo-qui">
          <b>{mien ? "Toi" : `${auteur.auteur.prenom} ${auteur.auteur.nom}`}</b>
          <small>{depuis(m.cree_le)} · {expireDans(m.expire_le)}{visi && visi.cle !== "tous" ? ` · ${visi.court}` : ""}{estMasque ? " · masqué" : ""}</small>
        </span>
        <span className="pub-menu mo-menu" ref={menuRef}>
          <button type="button" className="mo-bouton" aria-label="Options" onClick={() => { setMenu(!menu); setPause(!menu); }}><MoreHorizontal size={20} aria-hidden /></button>
          {menu && (
            <span className="pub-menu-liste vers-le-bas">
              {!mien && <button type="button" onClick={() => agir("signaler")}>Signaler</button>}
              {moderateur && !mien && <button type="button" onClick={() => agir("masquer")}>{estMasque ? "Rétablir" : "Masquer"}</button>}
              {(mien || moi.role === "admin") && <button type="button" className="danger" onClick={() => agir("supprimer")}>Supprimer</button>}
            </span>
          )}
        </span>
        <button type="button" className="mo-bouton" onClick={onFermer} aria-label="Fermer"><X size={22} aria-hidden /></button>
      </header>

      <div className="mo-scene" onPointerDown={debut} onPointerUp={fin} onPointerCancel={() => { clearTimeout(geste.current?.minuteur); geste.current = null; setPause(false); }}>
        {m.media_type === "photo"
          ? <img src={m.url} alt={m.legende || ""} draggable={false} />
          : <video ref={video} key={m.id} src={m.url} autoPlay playsInline preload="auto"
              onTimeUpdate={(e) => { const v = e.currentTarget; if (v.duration && isFinite(v.duration)) setAvancement(v.currentTime / v.duration); }}
              onEnded={suivant} />}
        {m.legende && <p className="mo-legende"><TexteMentions texte={m.legende} mentions={m.mentions ?? []} lien={false} /></p>}
        {pause && !menu && vues === null && <span className="mo-pause" aria-hidden>❚❚</span>}
      </div>

      {auteurs.length > 1 && (
        <>
          <button type="button" className="mo-fleche gauche" onClick={() => autreAuteur(-1)} aria-label="Personne précédente" disabled={ia === 0}><ChevronLeft size={22} aria-hidden /></button>
          <button type="button" className="mo-fleche droite" onClick={() => autreAuteur(1)} aria-label="Personne suivante"><ChevronRight size={22} aria-hidden /></button>
        </>
      )}

      <footer className="mo-pied">
        {mien ? (
          <div className="mo-pied-mien">
            <button type="button" className="mo-action" onClick={() => agir("vues")}>
              <Eye size={18} strokeWidth={1.9} aria-hidden /> {m.vues ?? 0} vue{(m.vues ?? 0) > 1 ? "s" : ""}
            </button>
            <span className="mo-resume">{resume || "Pas encore de réaction"}</span>
          </div>
        ) : (
          <>
            <form className="mo-reponse" onSubmit={(e) => { e.preventDefault(); agir("repondre"); }}>
              <input type="text" value={reponse} maxLength={500} placeholder={`Répondre à ${auteur.auteur.prenom}…`}
                onChange={(e) => setReponse(e.target.value)} onFocus={() => setPause(true)} onBlur={() => { if (!reponse) setPause(false); }} />
              <button type="submit" className="mo-envoyer" disabled={!reponse.trim() || envoi} aria-label="Envoyer en message privé"><Send size={18} aria-hidden /></button>
            </form>
            <div className="mo-emojis" role="group" aria-label="Réagir">
              {EMOJIS_MOMENT.map((e) => (
                <button key={e} type="button" className={reaction === e ? "on" : ""} onClick={() => agir("reaction", e)} aria-pressed={reaction === e} aria-label={`Réagir ${e}`}>{e}</button>
              ))}
            </div>
          </>
        )}
      </footer>

      {vues !== null && (
        <div className="fg-scrim msg-voile mo-vues-voile" role="presentation" onClick={() => { setVues(null); setPause(false); }}>
          <div className="msg-panneau" onClick={(e) => e.stopPropagation()}>
            <div className="msg-panneau-tete">
              <b>Vu par {Array.isArray(vues) ? vues.length : "…"}</b>
              <button type="button" className="cp-fermer" onClick={() => { setVues(null); setPause(false); }} aria-label="Fermer"><X size={18} aria-hidden /></button>
            </div>
            {resume && <p className="msg-aide" style={{ padding: "0 10px 8px" }}>Réactions : {resume}</p>}
            {Array.isArray(vues) && vues.length === 0 && <p className="msg-aide" style={{ padding: 10 }}>Personne pour l’instant.</p>}
            {Array.isArray(vues) && vues.map((v) => (
              <div key={v.id} className="mo-vue">
                <Avatar profil={{ prenom: v.prenom, nom: v.nom, photo: v.photo_url }} className="pub-avatar" />
                <span><b>{v.prenom} {v.nom}</b><small>{depuis(v.vu_le)}</small></span>
              </div>
            ))}
          </div>
        </div>
      )}
      {toast && <div className="toast la mo-toast" role="status">{toast}</div>}
    </div>,
    document.body
  );
}
