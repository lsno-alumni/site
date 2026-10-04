"use client";

import { useRef, useState } from "react";
import { noterNavigationComplete } from "@/components/SuiviNavigation";
import { texteErreur } from "@/lib/erreurs";
import { useRouter } from "next/navigation";
import { X, EyeOff, Eye, Paperclip, FileText } from "lucide-react";
import Avatar from "@/components/Avatar";
import * as memoire from "@/lib/memoire";
import { THEMES_CONSEIL, DOMAINES } from "@/lib/donnees";
import { poserQuestion, televerserPieceQuestion, PIECE_QUESTION_JOURS } from "@/lib/questions";
import { tailleLisible } from "@/lib/messages";

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
  const [piece, setPiece] = useState(null);   // { fichier, url }
  const fichierRef = useRef(null);
  const choisirPiece = (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/") && f.type !== "application/pdf") { setSouci("Photo ou PDF seulement."); return; }
    setSouci(""); setPiece({ fichier: f, url: f.type.startsWith("image/") ? URL.createObjectURL(f) : null });
  };
  const pret = titre.trim().length >= 5 && !envoi;

  const envoyer = async (e) => {
    e.preventDefault();
    if (!pret) return;
    setEnvoi(true); setSouci("");
    try {
      const jointe = piece ? await televerserPieceQuestion(piece.fichier) : null;
      const id = await poserQuestion({ titre, details, theme, domaine, anonyme, piece: jointe });
      memoire.ecrire("questions.liste", null); memoire.ecrire("fil.items", null);
      // en feuille : la question remplace le formulaire dans la feuille ; en
      // pleine page : chargement complet, sinon la feuille s'ouvrirait
      // par-dessus le formulaire resté derrière
      noterNavigationComplete(); if (enFeuille) routeur.replace(`/questions/${id}`); else window.location.assign(`/questions/${id}`);
    } catch (err) { setSouci("Impossible d'envoyer : " + texteErreur(err)); setEnvoi(false); }
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
        {piece && (
          <div className="msg-piece-apercu">
            {piece.url ? <img src={piece.url} alt="" /> : <span className="msg-piece-pdf statique"><FileText size={20} strokeWidth={1.7} aria-hidden /><span><b>{piece.fichier.name}</b><small>PDF · {tailleLisible(piece.fichier.size)}</small></span></span>}
            <span className="msg-piece-note">gardée {PIECE_QUESTION_JOURS} jours</span>
            <button type="button" className="cp-photo-retirer" onClick={() => { if (piece.url) URL.revokeObjectURL(piece.url); setPiece(null); }} aria-label="Retirer la pièce jointe"><X size={14} aria-hidden /></button>
          </div>
        )}
        <div>
          <button type="button" className="cp-outil" onClick={() => fichierRef.current?.click()}><Paperclip size={16} strokeWidth={1.9} aria-hidden /> {piece ? "Changer la pièce jointe" : "Joindre une photo ou un PDF"}</button>
          <input ref={fichierRef} type="file" accept="image/*,application/pdf" hidden onChange={choisirPiece} />
        </div>
        <p className="msg-aide" style={{ padding: 0 }}>Les anciens qui ont accepté de répondre aux cadets sur ce thème sont prévenus.</p>
        {souci && <p className="cp-souci" style={{ margin: 0 }} role="alert">{souci}</p>}
      </div>
    </form>
  );
}
