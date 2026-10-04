"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FileUp, Link2, Check, Loader2 } from "lucide-react";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { texteErreur } from "@/lib/erreurs";
import { TYPES, CLASSES, MATIERES, TAILLE_MAX_MO, deposerFichier, proposerDocument, tailleLisible } from "@/lib/bibliotheque";

// Le formulaire : le fichier part sur le Drive de l'association par morceaux
// (ou, à défaut, un lien vers un fichier déjà en ligne), puis la fiche est
// créée en attente de relecture. Rien n'est stocké sur le site.
const ANNEE = new Date().getFullYear();

export default function Proposer() {
  const [mode, setMode] = useState("fichier");   // fichier | lien
  const [fichier, setFichier] = useState(null);
  const [f, setF] = useState({ titre: "", type: "annale", matiere: "Mathématiques", matiereAutre: "", classe: "bac", annee: String(ANNEE), serie: "", description: "", lien: "" });
  const [accord, setAccord] = useState(false);
  const [etat, setEtat] = useState("");          // "" | depot | fiche | fait
  const [progres, setProgres] = useState(0);
  const [erreur, setErreur] = useState("");
  const [driveOk, setDriveOk] = useState(true);  // le dépôt de fichiers est-il branché ?
  const entree = useRef(null);
  const maj = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  // le serveur dit si le Drive est branché ; sinon on bascule sur le lien d'emblée
  useEffect(() => {
    fetch("/api/bibliotheque/depot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "etat" }) })
      .then((r) => { if (r.status === 503) { setDriveOk(false); setMode("lien"); } })
      .catch(() => {});
  }, []);

  const choisir = (e) => {
    const x = e.target.files?.[0]; e.target.value = "";
    if (!x) return;
    if (x.size > TAILLE_MAX_MO * 1048576) { setErreur(`Fichier trop lourd (${tailleLisible(x.size)}) : ${TAILLE_MAX_MO} Mo au maximum.`); return; }
    setErreur(""); setFichier(x);
    if (!f.titre.trim()) setF((v) => ({ ...v, titre: x.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").slice(0, 120) }));
  };

  const envoyer = async (e) => {
    e.preventDefault();
    setErreur("");
    const matiere = f.matiere === "Autre" ? f.matiereAutre.trim() : f.matiere;
    if (f.titre.trim().length < 3) { setErreur("Donne un titre d'au moins 3 caractères."); return; }
    if (matiere.length < 2) { setErreur("Indique la matière."); return; }
    if (!/^\d{4}$/.test(f.annee) || +f.annee < 1990 || +f.annee > ANNEE + 1) { setErreur("Indique une année valable (ex. 2019)."); return; }
    if (mode === "fichier" && !fichier) { setErreur("Choisis le fichier à déposer."); return; }
    if (mode === "lien" && !/^https?:\/\/\S+/.test(f.lien.trim())) { setErreur("Colle un lien complet, qui commence par https://."); return; }
    if (!accord) { setErreur("Confirme que ce document peut être partagé."); return; }
    try {
      let lien = f.lien.trim(), drive_id = null, taille = null;
      if (mode === "fichier") {
        setEtat("depot"); setProgres(0);
        const d = await deposerFichier(fichier, setProgres);
        lien = d.lien; drive_id = d.drive_id; taille = d.taille;
      }
      setEtat("fiche");
      await proposerDocument(creerClientNavigateur(), { ...f, matiere, lien, drive_id, taille });
      setEtat("fait");
    } catch (err) {
      setEtat("");
      if (err?.code === "drive_non_configure") { setDriveOk(false); setMode("lien"); setErreur("Le dépôt de fichiers n'est pas encore branché : colle un lien vers ton fichier en attendant."); }
      else setErreur(texteErreur(err));
    }
  };

  if (etat === "fait") {
    return (
      <div className="succes" style={{ paddingTop: 30 }}>
        <div className="coche" aria-hidden><Check size={30} strokeWidth={2} /></div>
        <h2>Merci, c&apos;est proposé</h2>
        <p>Un délégué relit ta proposition. Tu seras prévenu·e quand elle sera publiée, et elle apparaîtra dans la bibliothèque pour tous les membres.</p>
        <Link href="/bibliotheque" className="btn btn-or" style={{ marginTop: 20 }}>Retour à la bibliothèque</Link>
        <button type="button" className="btn btn-nu" style={{ marginTop: 10 }} onClick={() => { setEtat(""); setFichier(null); setAccord(false); setF((v) => ({ ...v, titre: "", description: "", lien: "" })); }}>Proposer un autre document</button>
      </div>
    );
  }

  return (
    <form className="f-corps bib-form" onSubmit={envoyer} style={{ paddingTop: 22 }}>
      <div className="bib-modes" role="tablist" aria-label="Source du document">
        <button type="button" role="tab" aria-selected={mode === "fichier"} className={mode === "fichier" ? "on" : ""} onClick={() => driveOk && setMode("fichier")} disabled={!driveOk}><FileUp size={15} aria-hidden /> Déposer un fichier</button>
        <button type="button" role="tab" aria-selected={mode === "lien"} className={mode === "lien" ? "on" : ""} onClick={() => setMode("lien")}><Link2 size={15} aria-hidden /> Donner un lien</button>
      </div>
      {!driveOk && <p className="bib-note">Le dépôt direct arrive bientôt. En attendant, mets ton fichier en ligne (Drive, autre) et colle le lien.</p>}

      {mode === "fichier" ? (
        <div className="champ">
          <label>Le fichier <small>(PDF de préférence, {TAILLE_MAX_MO} Mo au maximum)</small></label>
          <button type="button" className="bib-depot" onClick={() => entree.current?.click()}>
            <FileUp size={20} aria-hidden />
            {fichier ? <span><b>{fichier.name}</b> · {tailleLisible(fichier.size)}</span> : <span>Choisir le fichier à déposer sur le Drive de l&apos;association</span>}
          </button>
          <input ref={entree} type="file" accept="application/pdf,image/jpeg,image/png,image/webp,.doc,.docx" hidden onChange={choisir} />
        </div>
      ) : (
        <div className="champ">
          <label htmlFor="lien">Le lien vers le fichier</label>
          <input id="lien" type="url" className="saisie" placeholder="https://drive.google.com/…" value={f.lien} onChange={maj("lien")} />
          <small style={{ color: "var(--brume)", fontSize: 12.5 }}>Vérifie que le lien s&apos;ouvre sans demander d&apos;accès.</small>
        </div>
      )}

      <div className="champ"><label htmlFor="titre">Titre</label><input id="titre" className="saisie" maxLength={120} placeholder="Ex. Bac C 2019 — Mathématiques, 1er tour" value={f.titre} onChange={maj("titre")} /></div>
      <div className="bib-grille">
        <div className="champ"><label htmlFor="type">Type</label><select id="type" className="saisie" value={f.type} onChange={maj("type")}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="champ"><label htmlFor="classe">Classe</label><select id="classe" className="saisie" value={f.classe} onChange={maj("classe")}>{Object.entries(CLASSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="champ"><label htmlFor="matiere">Matière</label><select id="matiere" className="saisie" value={f.matiere} onChange={maj("matiere")}>{MATIERES.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
        {f.matiere === "Autre" ? (
          <div className="champ"><label htmlFor="matiere-autre">Laquelle ?</label><input id="matiere-autre" className="saisie" maxLength={40} value={f.matiereAutre} onChange={maj("matiereAutre")} /></div>
        ) : (
          <div className="champ"><label htmlFor="serie">Série <small>(facultatif)</small></label><input id="serie" className="saisie" maxLength={10} placeholder="C, D…" value={f.serie} onChange={maj("serie")} /></div>
        )}
        <div className="champ"><label htmlFor="annee">Année</label><input id="annee" className="saisie" inputMode="numeric" maxLength={4} value={f.annee} onChange={maj("annee")} /></div>
      </div>
      <div className="champ"><label htmlFor="description">Un mot <small>(facultatif)</small></label><textarea id="description" className="saisie" rows={2} maxLength={400} placeholder="Ex. Sujet complet avec le barème. Scanné par la promo 3." value={f.description} onChange={maj("description")} /></div>

      <label className="bib-accord">
        <input type="checkbox" checked={accord} onChange={(e) => setAccord(e.target.checked)} />
        <span>Ce document peut être partagé avec tous les membres : ce n&apos;est pas une copie d&apos;élève identifiable ni un document personnel.</span>
      </label>
      {erreur && <p role="alert" style={{ color: "var(--rouge)", fontSize: 13, lineHeight: 1.5 }}>{erreur}</p>}
      {etat === "depot" && (
        <div className="bib-progres" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progres * 100)}>
          <div style={{ width: `${Math.round(progres * 100)}%` }} /><span>Envoi vers le Drive… {Math.round(progres * 100)} %</span>
        </div>
      )}
      <button type="submit" className="btn btn-or btn-bloc" disabled={!!etat} style={{ opacity: etat ? 0.6 : 1 }}>
        {etat === "depot" ? <><Loader2 size={16} className="tourne" aria-hidden /> Envoi…</> : etat === "fiche" ? "Enregistrement…" : "Proposer"}
      </button>
    </form>
  );
}
