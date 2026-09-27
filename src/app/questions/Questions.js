"use client";

import { useEffect, useState } from "react";
import { texteErreur, avecReprise } from "@/lib/erreurs";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { HelpCircle, MessageCircle, CheckCircle2, EyeOff, PenLine, Search, Lock, Paperclip } from "lucide-react";
import Avatar from "@/components/Avatar";
import GlisserRafraichir from "@/components/GlisserRafraichir";
import RetourDynamique from "@/components/RetourDynamique";
import { RestaurerDefilement } from "@/components/SuiviNavigation";
import { SqueletteOffre } from "@/components/Squelettes";
import * as memoire from "@/lib/memoire";
import { depuis } from "@/lib/fil";
import { THEMES_CONSEIL } from "@/lib/donnees";
import { listeQuestions, FILTRES_QUESTIONS, urlPieceQuestion } from "@/lib/questions";
import useTempsReel from "@/lib/tempsReel";

// La liste des questions : filtres (toutes, sans réponse, ouvertes, résolues,
// les miennes) et thèmes ; une carte par question, qui s'ouvre en feuille.

export function CarteQuestion({ q }) {
  const a = q.auteur ?? {};
  const photo = q.fichier_type?.startsWith("image/") && q.fichier_chemin && !q.fichier_expiree ? urlPieceQuestion(q.fichier_chemin) : null;
  const pdf = q.fichier_type === "application/pdf" && !q.fichier_expiree;
  return (
    <Link href={`/questions/${q.id}`} className={`qa-carte${q.resolue ? " resolue" : ""}${q.masquee ? " pub-masquee" : ""}${photo ? " avec-vignette" : ""}`}>
      {photo && <img className="qa-vignette" src={photo} alt="" loading="lazy" />}
      <span className="qa-carte-haut">
        {q.theme && <span className="qa-theme">{q.theme}</span>}
        {q.resolue && <span className="qa-resolue"><CheckCircle2 size={12} aria-hidden /> Résolue</span>}
        {q.masquee && <span className="qa-resolue" style={{ color: "var(--rouge)" }}>masquée</span>}
        {q.fermee && <span className="qa-resolue" style={{ color: "var(--brume)" }}><Lock size={11} aria-hidden /> fermée</span>}
        {pdf && <span className="qa-resolue" style={{ color: "var(--brume)" }}><Paperclip size={11} aria-hidden /> PDF</span>}
      </span>
      <b className="qa-titre">{q.titre}</b>
      {q.details && <p className="qa-extrait">{q.details}</p>}
      <span className="qa-carte-bas">
        {a.anonyme && !a.id ? <span className="qa-anonyme"><EyeOff size={13} aria-hidden /> Anonyme</span>
          : <span className="qa-qui"><Avatar profil={{ prenom: a.prenom ?? "?", nom: a.nom ?? "", photo: a.photo_url }} className="com-avatar" />{a.prenom} {a.nom}{a.promo ? ` · P${a.promo}` : ""}{a.anonyme ? <em className="qa-anonyme" style={{ marginLeft: 4 }}><EyeOff size={12} aria-hidden /> anonyme</em> : null}</span>}
        <small>{depuis(q.cree_le)}</small>
        <span className={`qa-nb${q.nb_reponses === 0 ? " zero" : ""}`}><MessageCircle size={13} aria-hidden /> {q.nb_reponses === 0 ? "Aucune réponse" : `${q.nb_reponses} réponse${q.nb_reponses > 1 ? "s" : ""}`}</span>
      </span>
    </Link>
  );
}

export default function Questions() {
  const routeur = useRouter();
  const chemin = usePathname();
  const [filtre, setFiltre] = useState(() => (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("filtre")) || memoire.lire("questions.filtre") || "toutes");
  const [q, setQ] = useState("");
  const [theme, setTheme] = useState(() => memoire.lire("questions.theme") ?? null);
  const [liste, setListe] = useState(() => memoire.lire("questions.liste") ?? null);
  const [fin, setFin] = useState(false);
  const [encore, setEncore] = useState(false);
  const [souci, setSouci] = useState("");

  const charger = async (f = filtre, t = theme, mots = q) => {
    try { const l = await avecReprise(() => listeQuestions({ filtre: f, theme: t, q: mots })); setListe(l); setFin(l.length < 20); setSouci(""); }
    catch (e) { setSouci("Les questions ne répondent pas : " + texteErreur(e)); if (liste === null) setListe([]); }
  };
  useTempsReel(["questions", "reponses"], () => charger());
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { if (chemin === "/questions" && (liste === null || memoire.lire("questions.liste") === null)) charger(); }, [chemin]);
  useEffect(() => { if (liste !== null) memoire.ecrire("questions.liste", liste); memoire.ecrire("questions.filtre", filtre); memoire.ecrire("questions.theme", theme); }, [liste, filtre, theme]);

  const choisir = (f, t) => { setFiltre(f); setTheme(t); setListe(null); charger(f, t); };
  // recherche : 300 ms après la dernière frappe
  useEffect(() => {
    if (liste === null && !q) return;
    const minuteur = setTimeout(() => charger(filtre, theme, q), 300);
    return () => clearTimeout(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  const suite = async () => {
    if (encore || fin || !liste?.length) return;
    setEncore(true);
    try { const l = await listeQuestions({ filtre, theme, avant: liste[liste.length - 1].cree_le }); setListe((x) => [...x, ...l]); setFin(l.length < 20); }
    catch { /* on réessaiera */ }
    setEncore(false);
  };

  return (
    <GlisserRafraichir onRafraichir={async () => { await charger(); routeur.refresh(); }}>
    <>
      <header className="n-tete tete-questions">
        <RetourDynamique secours="/fil" libelle="Retour" />
        <h1 style={{ marginTop: 8 }}>Questions<br />aux <em>anciens</em></h1>
        <p className="cpt">Tu hésites, tu ne sais pas : demande. Quelqu&apos;un est passé par là.</p>
      </header>

      <div className="msg-recherche msg-recherche-liste">
        <Search size={16} strokeWidth={1.9} aria-hidden />
        <input className="saisie" placeholder="Rechercher une question…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="n-panneau qa-filtres">
        <div className="n-filtres">
          {FILTRES_QUESTIONS.map((f) => (
            <button key={f.cle} className={`puce${filtre === f.cle ? " active" : ""}`} onClick={() => choisir(f.cle, theme)}>{f.nom}</button>
          ))}
        </div>
        <div className="n-filtres qa-themes">
          <button className={`puce${theme === null ? " active" : ""}`} onClick={() => choisir(filtre, null)}>Tous les thèmes</button>
          {THEMES_CONSEIL.map((t) => (
            <button key={t} className={`puce${theme === t ? " active" : ""}`} onClick={() => choisir(filtre, t)}>{t}</button>
          ))}
        </div>
      </div>

      <div className="qa-liste">
        {liste === null && [0, 1, 2].map((i) => <SqueletteOffre key={i} />)}
        {liste?.map((q) => <CarteQuestion key={q.id} q={q} />)}
        {liste?.length === 0 && (
          <div className="vide" style={{ paddingTop: 30 }}>
            <div className="gros" aria-hidden><HelpCircle size={30} strokeWidth={1.6} /></div>
            <b>{filtre === "miennes" ? "Tu n'as encore rien demandé" : "Pas de question ici"}</b>{" "}
            {filtre === "miennes" ? "Pose ta première question avec la plume." : "Sois le premier à poser la tienne."}
          </div>
        )}
        {liste !== null && !fin && liste.length > 0 && (
          <button type="button" className="btn btn-nu fil-suite" onClick={suite} disabled={encore}>{encore ? "Chargement…" : "Voir plus"}</button>
        )}
        {souci && <p className="vide">{souci}</p>}
      </div>

      <Link href="/questions/nouvelle" className="fil-fab" aria-label="Poser une question"><PenLine size={20} strokeWidth={2} aria-hidden /></Link>
      <RestaurerDefilement />
    </>
    </GlisserRafraichir>
  );
}
