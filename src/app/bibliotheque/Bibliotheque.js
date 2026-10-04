"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, ExternalLink, Search, Plus, Trash2 } from "lucide-react";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { texteErreur } from "@/lib/erreurs";
import { SqueletteFiche } from "@/components/Squelettes";
import { listeBibliotheque, supprimerDocument, TYPES, CLASSES, libelleType, libelleClasse, tailleLisible } from "@/lib/bibliotheque";
import { marquerDecouverte } from "@/lib/tour";

// La bibliothèque : filtres (type, matière, classe, année), recherche, fiches.
// Chaque fiche ouvre le fichier sur le Drive de l'association (ou le lien).
export default function Bibliotheque({ moi }) {
  const [fiches, setFiches] = useState(null);
  const [miennes, setMiennes] = useState([]);   // mes propositions en attente
  const [souci, setSouci] = useState("");
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [matiere, setMatiere] = useState("");
  const [classe, setClasse] = useState("");
  const [annee, setAnnee] = useState("");

  const charger = async () => {
    const supabase = creerClientNavigateur();
    try {
      const l = await listeBibliotheque(supabase, "publie");
      setFiches(l);
      // mes propositions encore en attente : visibles de moi seul, pour savoir où elles en sont
      if (moi?.role === "delegue" || moi?.role === "admin") {
        const a = await listeBibliotheque(supabase, "en_attente").catch(() => []);
        setMiennes(a.filter((f) => f.propose_par === moi.id));
      }
    } catch (e) { setSouci(texteErreur(e)); setFiches([]); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { charger(); marquerDecouverte("bibliotheque"); }, []);   // venir ici vaut découverte : la pastille de l'accueil s'efface

  const matieres = useMemo(() => [...new Set((fiches ?? []).map((f) => f.matiere))].sort((a, b) => a.localeCompare(b, "fr")), [fiches]);
  const annees = useMemo(() => [...new Set((fiches ?? []).map((f) => f.annee))].sort((a, b) => b - a), [fiches]);
  const visibles = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (fiches ?? []).filter((f) =>
      (!type || f.type === type) && (!matiere || f.matiere === matiere) && (!classe || f.classe === classe) && (!annee || String(f.annee) === annee) &&
      (!n || `${f.titre} ${f.matiere} ${f.serie ?? ""} ${f.description ?? ""}`.toLowerCase().includes(n)));
  }, [fiches, q, type, matiere, classe, annee]);

  const retirer = async (f) => {
    if (!window.confirm("Retirer cette fiche de la bibliothèque ?")) return;
    try { await supprimerDocument(creerClientNavigateur(), f.id); await charger(); } catch (e) { setSouci(texteErreur(e)); }
  };

  return (
    <div className="bib">
      <div className="bib-actions">
        <Link href="/bibliotheque/proposer" className="btn btn-or"><Plus size={16} aria-hidden /> Proposer un document</Link>
      </div>
      <div className="bib-filtres">
        <label className="bib-recherche"><Search size={16} aria-hidden /><input type="search" className="saisie" placeholder="Rechercher un sujet, une matière…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" /></label>
        <div className="bib-selects">
          <select className="saisie" value={type} onChange={(e) => setType(e.target.value)} aria-label="Type"><option value="">Tous les types</option>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select className="saisie" value={matiere} onChange={(e) => setMatiere(e.target.value)} aria-label="Matière"><option value="">Toutes les matières</option>{matieres.map((m) => <option key={m} value={m}>{m}</option>)}</select>
          <select className="saisie" value={classe} onChange={(e) => setClasse(e.target.value)} aria-label="Classe"><option value="">Toutes les classes</option>{Object.entries(CLASSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select className="saisie" value={annee} onChange={(e) => setAnnee(e.target.value)} aria-label="Année"><option value="">Toutes les années</option>{annees.map((a) => <option key={a} value={a}>{a}</option>)}</select>
        </div>
      </div>
      {souci && <p className="pu-vide">{souci}</p>}
      {fiches === null && <><SqueletteFiche /><SqueletteFiche /></>}
      {fiches && fiches.length === 0 && !souci && (
        <p className="pu-vide">La bibliothèque est encore vide. Tu as gardé un sujet, une composition, un cours ? Propose-le : les délégués le relisent, et il servira aux cadets.</p>
      )}
      {fiches && fiches.length > 0 && visibles.length === 0 && <p className="pu-vide">Rien ne correspond à ces filtres.</p>}
      <ul className="bib-liste">
        {visibles.map((f) => (
          <li key={f.id} className="bib-fiche">
            <a href={f.lien} target="_blank" rel="noopener noreferrer" className="bib-ouvrir">
              <span className="bib-icone"><FileText size={22} strokeWidth={1.7} aria-hidden /></span>
              <span className="bib-corps">
                <span className="bib-meta"><b>{libelleType(f.type)}</b> · {f.matiere} · {libelleClasse(f.classe)}{f.serie ? ` ${f.serie}` : ""} · {f.annee}</span>
                <span className="bib-titre">{f.titre}</span>
                {f.description && <span className="bib-desc">{f.description}</span>}
                <span className="bib-pied">{f.taille ? `${tailleLisible(f.taille)} · ` : ""}{f.auteur ? `proposé par ${f.auteur.prenom}${f.auteur.promo ? ` (promo ${f.auteur.promo})` : ""}` : "proposé par un membre"} <ExternalLink size={12} aria-hidden /></span>
              </span>
            </a>
            {(moi?.role === "delegue" || moi?.role === "admin") && (
              <button type="button" className="bib-retirer" onClick={() => retirer(f)} aria-label="Retirer cette fiche"><Trash2 size={15} aria-hidden /></button>
            )}
          </li>
        ))}
      </ul>
      {miennes.length > 0 && (
        <p className="bib-attente">{miennes.length} de tes propositions attend{miennes.length > 1 ? "ent" : ""} une relecture.</p>
      )}
    </div>
  );
}
