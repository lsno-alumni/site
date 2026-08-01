"use client";

import { useEffect, useState } from "react";
import { Download, X, Check } from "lucide-react";
import {
  dejaInstallee, inviteDisponible, lancerInstallation, plateforme, MODES,
  modeInvitationInstall, CLE_INSTALL_ECARTEE,
} from "@/lib/installation";

const CLE_ECARTEE = CLE_INSTALL_ECARTEE;

// Gestes à faire, quand le navigateur ne propose pas de bouton
function Etapes({ mode }) {
  return (
    <ol className="install-etapes">
      {mode.etapes.map((e, i) => <li key={i}>{e}</li>)}
    </ol>
  );
}

// ============================================================
// A) Bandeau sur l'accueil — proposition au bon moment
//    Un seul bandeau à la fois, et l'installation PASSE AVANT celui des
//    notifications sur TOUS les appareils : l'appli installée est la meilleure
//    porte d'entrée (et sur iPhone, les notifications en dépendent).
// ============================================================
export function InviteInstallation() {
  const [etat, setEtat] = useState(null);   // null = on décide, "bouton" | "gestes" | null
  const [fait, setFait] = useState(false);

  useEffect(() => {
    // l'installation est prioritaire sur les notifications (voir lib/installation.js)
    modeInvitationInstall().then(setEtat);
  }, []);

  const installer = async () => {
    if (await lancerInstallation()) { setFait(true); setTimeout(() => setEtat(null), 2500); }
  };
  const ecarter = () => {
    try { localStorage.setItem(CLE_ECARTEE, "1"); } catch { /* ignore */ }
    setEtat(null);
  };

  if (!etat) return null;

  return (
    <div className="invite-notif">
      <span className="ico" aria-hidden>
        {fait ? <Check size={16} strokeWidth={2.2} /> : <Download size={16} strokeWidth={1.9} />}
      </span>
      {fait ? (
        <span className="txt"><b>C&apos;est installé ✓</b>{" "}Ouvre LSNO Amicale depuis tes applis.</span>
      ) : (
        <>
          <span className="txt">
            <b>Installe l&apos;appli</b>
            {etat === "bouton"
              ? "Un appui, et le réseau rejoint tes applications — sans passer par le navigateur."
              : "Ajoute LSNO Amicale à ton écran d'accueil (nécessaire aussi pour les notifications sur iPhone)."}
          </span>
          {etat === "bouton" ? (
            <button type="button" className="btn btn-notif" onClick={installer}>Installer</button>
          ) : (
            <a href="/a-propos#installer" className="btn btn-notif">Comment faire</a>
          )}
          <button type="button" className="fermer" onClick={ecarter} aria-label="Plus tard">
            <X size={15} aria-hidden />
          </button>
        </>
      )}
    </div>
  );
}

// ============================================================
// B) Bloc permanent (page À propos) — toujours trouvable, même après avoir
//    écarté le bandeau. C'est le lien à envoyer à quelqu'un qui ne sait pas faire.
// ============================================================
export function BlocInstallation() {
  const [prete, setPrete] = useState(false);      // le navigateur propose un bouton
  const [installee, setInstallee] = useState(false);
  const [mode, setMode] = useState(null);
  const [tout, setTout] = useState(false);        // voir les autres appareils
  const [fait, setFait] = useState(false);

  useEffect(() => {
    setInstallee(dejaInstallee());
    setMode(plateforme());
    const t = setTimeout(() => setPrete(inviteDisponible()), 1500);
    return () => clearTimeout(t);
  }, []);

  const installer = async () => {
    if (await lancerInstallation()) { setFait(true); setInstallee(true); }
  };

  if (!mode) return null;
  const autres = Object.entries(MODES).filter(([k]) => k !== mode);

  return (
    <section id="installer" className="bloc-install">
      <h3>Installer l&apos;appli sur ton téléphone</h3>
      {installee || fait ? (
        <p className="ok"><Check size={14} strokeWidth={2.2} aria-hidden /> C&apos;est déjà installé sur cet appareil.</p>
      ) : (
        <>
          <p className="intro">
            LSNO Amicale s&apos;installe comme une vraie application : une icône sur ton écran
            d&apos;accueil, l&apos;ouverture en plein écran, et les notifications qui fonctionnent
            (indispensable sur iPhone). Rien à télécharger sur un store.
          </p>
          {prete ? (
            <button type="button" className="btn btn-notif" onClick={installer}>
              <Download size={15} aria-hidden /> Installer maintenant
            </button>
          ) : (
            <>
              <p className="quel">{MODES[mode].titre}</p>
              <Etapes mode={MODES[mode]} />
            </>
          )}
        </>
      )}

      <button type="button" className="autres" onClick={() => setTout(!tout)}>
        {tout ? "Masquer les autres appareils" : "Je suis sur un autre appareil"}
      </button>
      {tout && autres.map(([k, m]) => (
        <div key={k} className="autre">
          <p className="quel">{m.titre}</p>
          <Etapes mode={m} />
        </div>
      ))}
    </section>
  );
}
