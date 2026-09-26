"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, EyeOff, MoreHorizontal, Send, Award, Pencil, Trash2, Flag, EyeOff as Masquer, Eye, Share2 } from "lucide-react";
import Avatar from "@/components/Avatar";
import Bravo from "@/components/Bravo";
import useClicDehors from "@/lib/useClicDehors";
import * as memoire from "@/lib/memoire";
import { depuis, signaler } from "@/lib/fil";
import { useMentions, SuggestionsMention, TexteMentions } from "@/lib/mentions";
import { lireQuestion, repondre, modifierReponse, supprimerReponse, retenirReponse, modifierQuestion, supprimerQuestion, modererQuestion } from "@/lib/questions";

// Une question ouverte (page /questions/[id] ET feuille depuis la liste).
// TeteQuestion (thème, titre, auteur : glissable) puis SuiteQuestion
// (détails, bravo, réponses, saisie : interactive).

export function TeteQuestion({ q }) {
  const a = q.auteur ?? {};
  return (
    <div className="qa-tete">
      <span className="qa-carte-haut">
        {q.theme && <span className="qa-theme">{q.theme}</span>}
        {q.resolue && <span className="qa-resolue"><CheckCircle2 size={12} aria-hidden /> Résolue</span>}
        {q.masquee && <span className="qa-resolue" style={{ color: "var(--rouge)" }}>masquée par la modération</span>}
      </span>
      <h1 className="qa-titre-page">{q.titre}</h1>
      <div className="qa-carte-bas">
        {a.anonyme && !a.id ? <span className="qa-anonyme"><EyeOff size={13} aria-hidden /> Anonyme</span>
          : <Link href={`/profil/${a.id}`} className="qa-qui"><Avatar profil={{ prenom: a.prenom ?? "?", nom: a.nom ?? "", photo: a.photo_url }} className="com-avatar" />{a.prenom} {a.nom}{a.promo ? ` · Promo ${a.promo}` : ""}{a.anonyme ? " · anonyme pour les autres" : ""}</Link>}
        <small>{depuis(q.cree_le)}</small>
      </div>
    </div>
  );
}

export function SuiteQuestion({ q: initial, moi, moderateur, enFeuille = false, onMaj }) {
  const routeur = useRouter();
  const [q, setQ] = useState(initial);
  const [texte, setTexte] = useState("");
  const [edition, setEdition] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [menu, setMenu] = useState(null);   // "q" ou id de réponse
  const [toast, setToast] = useState("");
  const champ = useRef(null);
  const mentions = useMentions(texte, setTexte, champ);
  // en feuille, la saisie est posée au bas de l'ÉCRAN (portail) : dans la
  // feuille elle-même, « fixed » se rapporte à la feuille, qui peut dépasser
  // sous l'écran à mi-hauteur — même remède que les commentaires du Fil
  const [monte, setMonte] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMonte(true); }, []);
  const signale = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };
  useClicDehors(menu !== null, (e) => !!e.target.closest?.(".qa-menu"), () => setMenu(null));
  // la tête (titre, badge « Résolue ») vit chez le parent : on la tient au courant
  const recharger = async () => { try { const n = await lireQuestion(q.id); if (n) { setQ(n); onMaj?.(n); } memoire.ecrire("questions.liste", null); memoire.ecrire("fil.items", null); } catch { /* on garde l'état */ } };

  const envoyer = async (e) => {
    e.preventDefault();
    if (!texte.trim() || envoi) return;
    setEnvoi(true);
    try {
      if (edition) await modifierReponse(edition.id, texte); else await repondre(q.id, texte);
      setTexte(""); setEdition(null); mentions.vider(); await recharger();
    } catch (err) { signale("Envoi impossible : " + (err.message ?? "")); }
    setEnvoi(false);
  };
  const retenir = async (r) => {
    setMenu(null);
    try { await retenirReponse(q.id, q.meilleure_reponse === r.id ? null : r.id); await recharger(); }
    catch (e) { signale("Impossible : " + (e.message ?? "")); }
  };
  const basculerResolue = async () => {
    setMenu(null);
    try { await modifierQuestion(q.id, { resolue: !q.resolue, ...(q.resolue ? { meilleure_reponse: null } : {}) }); await recharger(); }
    catch (e) { signale("Impossible : " + (e.message ?? "")); }
  };
  const agir = async (cible, action) => {
    setMenu(null);
    try {
      if (action === "signaler") { await signaler(cible === "q" ? "question" : "reponse", cible === "q" ? q.id : cible.id, cible === "q" ? "Question signalée depuis l'application" : "Réponse signalée depuis l'application"); signale("Merci, les modérateurs sont prévenus."); }
      if (action === "masquer") { await modererQuestion(cible === "q" ? "question" : "reponse", cible === "q" ? q.id : cible.id, !(cible === "q" ? q.masquee : cible.masquee)); await recharger(); }
      if (action === "supprimer") {
        if (cible === "q") { if (!confirm("Supprimer cette question et ses réponses ?")) return; await supprimerQuestion(q.id); memoire.ecrire("questions.liste", null); memoire.ecrire("fil.items", null); routeur.replace("/questions"); return; }
        if (!confirm("Supprimer ta réponse ?")) return; await supprimerReponse(cible.id); await recharger();
      }
      if (action === "modifier") { setEdition(cible); setTexte(cible.texte); champ.current?.focus(); }
      if (action === "partager") {
        const url = `${window.location.origin}/questions/${q.id}`;
        if (navigator.share) await navigator.share({ title: q.titre, url }); else { await navigator.clipboard.writeText(url); signale("Lien copié"); }
      }
    } catch (e) { if (e?.name !== "AbortError") signale("Action impossible : " + (e.message ?? "")); }
  };

  const reponses = (q.reponses ?? []).filter((r) => !r.masquee || moderateur || r.auteur.id === moi.id);

  return (
    <>
      {q.details && <p className="qa-details"><TexteMentions texte={q.details} mentions={[]} /></p>}
      <div className="pub-pied pu-actions qa-actions">
        <Bravo type="question" id={q.id} nombre={q.bravos} actif={q.jai_bravo} />
        <span className="pub-action" style={{ cursor: "default" }}>{reponses.length} réponse{reponses.length > 1 ? "s" : ""}</span>
        <span className="qa-menu pub-menu">
          <button type="button" className="pub-action" aria-label="Options" onClick={() => setMenu(menu === "q" ? null : "q")}><MoreHorizontal size={16} aria-hidden /></button>
          {menu === "q" && (
            <span className="pub-menu-liste">
              <button type="button" onClick={() => agir("q", "partager")}><Share2 size={14} aria-hidden /> Partager</button>
              {q.est_moi && <button type="button" onClick={basculerResolue}><CheckCircle2 size={14} aria-hidden /> {q.resolue ? "Rouvrir la question" : "Marquer comme résolue"}</button>}
              {!q.est_moi && <button type="button" onClick={() => agir("q", "signaler")}><Flag size={14} aria-hidden /> Signaler</button>}
              {moderateur && <button type="button" onClick={() => agir("q", "masquer")}>{q.masquee ? <><Eye size={14} aria-hidden /> Rétablir</> : <><Masquer size={14} aria-hidden /> Masquer</>}</button>}
              {(q.est_moi || moi.role === "admin") && <button type="button" className="danger" onClick={() => agir("q", "supprimer")}><Trash2 size={14} aria-hidden /> Supprimer</button>}
            </span>
          )}
        </span>
      </div>

      <section className={`qa-reponses${enFeuille ? " qa-reponses-fixe" : ""}`}>
        {reponses.length === 0 && <p className="pu-vide">Personne n&apos;a encore répondu. {q.est_moi ? "Les anciens concernés sont prévenus." : "Tu es passé par là ? Réponds."}</p>}
        {reponses.map((r) => {
          const mienne = r.auteur.id === moi.id;
          const retenue = q.meilleure_reponse === r.id;
          return (
            <article key={r.id} className={`qa-reponse${retenue ? " retenue" : ""}${r.masquee ? " com-masque" : ""}`}>
              {retenue && <span className="qa-retenue"><Award size={13} aria-hidden /> Réponse retenue par l&apos;auteur</span>}
              <Link href={`/profil/${r.auteur.id}`} className="pub-qui">
                <Avatar profil={{ prenom: r.auteur.prenom, nom: r.auteur.nom, photo: r.auteur.photo_url }} className="pub-avatar" />
                <span>
                  <b>{r.auteur.prenom} {r.auteur.nom}</b>
                  <small>{r.auteur.statut_titre || `Promo ${r.auteur.promo}`} · {depuis(r.cree_le)}{r.modifie_le ? " · modifiée" : ""}{r.masquee ? " · masquée" : ""}</small>
                </span>
              </Link>
              <p className="qa-reponse-texte"><TexteMentions texte={r.texte} mentions={[]} /></p>
              <div className="qa-reponse-pied">
                <Bravo type="reponse" id={r.id} nombre={r.bravos} actif={r.jai_bravo} />
                {q.est_moi && !mienne && (
                  <button type="button" className={`pub-action${retenue ? " on" : ""}`} onClick={() => retenir(r)}>
                    <Award size={15} strokeWidth={1.9} aria-hidden /> {retenue ? "Retenue" : "Retenir"}
                  </button>
                )}
                <span className="qa-menu pub-menu">
                  <button type="button" className="pub-action" aria-label="Options" onClick={() => setMenu(menu === r.id ? null : r.id)}><MoreHorizontal size={16} aria-hidden /></button>
                  {menu === r.id && (
                    <span className="pub-menu-liste">
                      {mienne && <button type="button" onClick={() => agir(r, "modifier")}><Pencil size={14} aria-hidden /> Modifier</button>}
                      {!mienne && <button type="button" onClick={() => agir(r, "signaler")}><Flag size={14} aria-hidden /> Signaler</button>}
                      {!mienne && moderateur && <button type="button" onClick={() => agir(r, "masquer")}>{r.masquee ? "Rétablir" : "Masquer"}</button>}
                      {(mienne || moi.role === "admin") && <button type="button" className="danger" onClick={() => agir(r, "supprimer")}><Trash2 size={14} aria-hidden /> Supprimer</button>}
                    </span>
                  )}
                </span>
              </div>
            </article>
          );
        })}
      </section>

      {(() => { const saisie = (
      <form className={`com-saisie${enFeuille ? " com-saisie-fixe" : ""}`} onSubmit={envoyer}>
        {edition && (
          <div className="com-saisie-vers"><Pencil size={12} aria-hidden /> Modification de ta réponse
            <button type="button" onClick={() => { setEdition(null); setTexte(""); }} aria-label="Annuler">×</button>
          </div>
        )}
        <SuggestionsMention suggestions={mentions.suggestions} choisir={mentions.choisir} className="mention-liste-haut" />
        <div className="com-saisie-ligne">
          <Avatar profil={moi} className="com-avatar" />
          <textarea ref={champ} className="saisie" rows={1} placeholder={q.est_moi ? "Préciser ta question, remercier…" : "Ta réponse, ton expérience…"}
            value={texte} onChange={mentions.surChangement} maxLength={2000}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); envoyer(e); } }} />
          <button type="submit" className="com-envoyer" disabled={!texte.trim() || envoi} aria-label={edition ? "Enregistrer" : "Répondre"}>{edition ? <Pencil size={16} aria-hidden /> : <Send size={17} aria-hidden />}</button>
        </div>
      </form>); return enFeuille && monte ? createPortal(saisie, document.body) : saisie; })()}
      <div className={`toast${toast ? " la" : ""}`} role="status">{toast}</div>
    </>
  );
}

export default function ContenuQuestion({ q: initial, moi, moderateur }) {
  const [q, setQ] = useState(initial);
  return (
    <>
      <TeteQuestion q={q} />
      <SuiteQuestion q={q} moi={moi} moderateur={moderateur} onMaj={setQ} />
    </>
  );
}
