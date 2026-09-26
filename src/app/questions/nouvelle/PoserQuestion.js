"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, EyeOff, Eye } from "lucide-react";
import Avatar from "@/components/Avatar";
import * as memoire from "@/lib/memoire";
import { THEMES_CONSEIL, DOMAINES } from "@/lib/donnees";
import { poserQuestion } from "@/lib/questions";

const TITRE_MAX = 140;
const DETAILS_MAX = 2000;

// Poser une question : un titre court (la question elle-même), des détails,
// un thème, un domaine facultatif, et le choix d'apparaître ou de rester
// anonyme (les modérateurs voient toujours qui a posé la question).
export default function PoserQuestion({ moi, enFeuille = false }) {
  const routeur = useRouter();
  const [titre, setTitre] = useState("");
  const [details, setDetails] = useState("");
  const [theme, setTheme] = useState("");
  const [domaine, setDomaine] = useState("");
  const [anonyme, setAnonyme] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [souci, setSouci] = useState("");
  const pret = titre.trim().length >= 5 && !envoi;

  const envoyer = async (e) => {
    e.preventDefault();
    if (!pret) return;
    setEnvoi(true); setSouci("");
    try {
      const id = await poserQuestion({ titre, details, theme, domaine, anonyme });
      memoire.ecrire("questions.liste", null); memoire.ecrire("fil.items", null);
      routeur.replace(`/questions/${id}`);
    } catch (err) { setSouci("Impossible d'envoyer : " + (err?.message ?? "")); setEnvoi(false); }
  };

  return (
    <form className={`cp${enFeuille ? " cp-feuille" : ""}`} onSubmit={envoyer}>
      <header className="cp-tete">
        <button type="button" className="cp-fermer" onClick={() => routeur.back()} aria-label="Annuler"><X size={20} aria-hidden /></button>
        <span className="cp-titre">Poser une question</span>
        <button type="submit" className={`btn btn-or cp-publier${pret ? "" : " off"}`} disabled={!pret}>{envoi ? "Envoi…" : "Publier"}</button>
      </header>

      <div className="cp-qui">
        {anonyme ? <span className="avatar-init pub-avatar" aria-hidden><EyeOff size={16} /></span> : <Avatar profil={moi} className="pub-avatar" />}
        <span>
          <b>{anonyme ? "Anonyme" : `${moi.prenom} ${moi.nom}`}</b>
          <button type="button" className="cp-visi" onClick={() => setAnonyme(!anonyme)} aria-pressed={anonyme}>
            {anonyme ? <><Eye size={13} aria-hidden /> Montrer mon nom</> : <><EyeOff size={13} aria-hidden /> Poser en anonyme</>}
          </button>
        </span>
      </div>
      {anonyme && <p className="msg-aide" style={{ padding: "8px 20px 0" }}>Ton nom n&apos;apparaît pas pour les membres. Les délégués et administrateurs le voient, pour la modération.</p>}

      <div className="qa-form">
        <input className="saisie qa-form-titre" placeholder="Ta question, en une phrase" value={titre} maxLength={TITRE_MAX}
          onChange={(e) => setTitre(e.target.value)} autoFocus />
        <small className="cp-compte">{titre.length} / {TITRE_MAX}</small>
        <textarea className="saisie" placeholder="Les détails qui aident à répondre : ta situation, ce que tu as déjà essayé…" rows={6} value={details} maxLength={DETAILS_MAX}
          onChange={(e) => setDetails(e.target.value)} />
        <label className="champ">
          <span>Thème</span>
          <select className="saisie" value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option value="">Choisir un thème (facultatif)</option>
            {THEMES_CONSEIL.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="champ">
          <span>Domaine concerné</span>
          <select className="saisie" value={domaine} onChange={(e) => setDomaine(e.target.value)}>
            <option value="">Tous les domaines</option>
            {DOMAINES.map((d) => <option key={d.cle} value={d.cle}>{d.nom}</option>)}
          </select>
        </label>
        <p className="msg-aide" style={{ padding: 0 }}>Les anciens qui ont accepté de répondre aux cadets sur ce thème sont prévenus.</p>
        {souci && <p className="cp-souci" style={{ margin: 0 }} role="alert">{souci}</p>}
      </div>
    </form>
  );
}
