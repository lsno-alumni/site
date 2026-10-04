"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { membresJoignables } from "@/lib/messages";

// Mentions « @Prénom Nom » : on tape « @ », les membres se proposent, on en
// choisit un, son nom s'insère et son identifiant est retenu (colonne
// `mentions` en base). À l'affichage, chaque « @Prénom Nom » d'une personne
// retenue devient un lien vers son profil.

let carnetCache = null;
export async function carnet() {
  if (!carnetCache) carnetCache = await membresJoignables();
  return carnetCache;
}
const plat = (s) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const nomComplet = (m) => `${m.prenom ?? ""} ${m.nom ?? ""}`.trim();

// « @ » suivi d'au plus deux mots (prénom, début du nom), juste avant le curseur
const MOTIF = /(?:^|\s)@([^\s@]{0,30}(?: [^\s@]{0,30})?)$/;

export function useMentions(texte, setTexte, champRef) {
  const [retenus, setRetenus] = useState([]);        // {id, prenom, nom}
  const [suggestions, setSuggestions] = useState([]);
  const [portee, setPortee] = useState(null);        // {debut, fin} du « @… » en cours
  const membres = useRef(null);
  useEffect(() => { carnet().then((m) => { membres.current = m; }).catch(() => {}); }, []);

  const analyser = useCallback((valeur, caret) => {
    const m = valeur.slice(0, caret).match(MOTIF);
    if (!m || !membres.current) { setSuggestions([]); setPortee(null); return; }
    const q = plat(m[1]);
    const s = membres.current
      .filter((x) => plat(nomComplet(x)).startsWith(q) || plat(x.nom).startsWith(q))
      .slice(0, 6);
    setSuggestions(s);
    setPortee({ debut: caret - m[1].length - 1, fin: caret });
  }, []);

  const surChangement = (e) => {
    setTexte(e.target.value);
    analyser(e.target.value, e.target.selectionStart ?? e.target.value.length);
  };

  const choisir = (mb) => {
    if (!portee) return;
    const insertion = `@${nomComplet(mb)} `;
    setTexte(texte.slice(0, portee.debut) + insertion + texte.slice(portee.fin));
    setRetenus((l) => (l.some((x) => x.id === mb.id) ? l : [...l, { id: mb.id, prenom: mb.prenom, nom: mb.nom }]));
    setSuggestions([]);
    const pos = portee.debut + insertion.length;
    setPortee(null);
    requestAnimationFrame(() => { const el = champRef?.current; if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch { /* input sans sélection */ } } });
  };

  // à l'envoi : seuls ceux dont le « @Prénom Nom » figure encore dans le texte
  const idsPour = (t) => retenus.filter((m) => t.includes(`@${nomComplet(m)}`)).map((m) => m.id);
  // pour reprendre un texte existant (modification) : on retient d'avance ses mentions
  const reprendre = (liste) => setRetenus(liste ?? []);
  const vider = () => { setRetenus([]); setSuggestions([]); setPortee(null); };
  return { surChangement, suggestions, choisir, idsPour, reprendre, vider };
}

export function SuggestionsMention({ suggestions, choisir, className = "" }) {
  if (!suggestions.length) return null;
  return (
    <div className={`mention-liste ${className}`} role="listbox" aria-label="Membres à mentionner">
      {suggestions.map((m) => (
        // onMouseDown : avant le blur du champ (sinon le clic n'aboutit pas sur certains téléphones)
        <button key={m.id} type="button" role="option" onMouseDown={(e) => { e.preventDefault(); choisir(m); }}>
          <Avatar profil={{ prenom: m.prenom, nom: m.nom, photo: m.photo_url }} className="com-avatar" />
          <span><b>{nomComplet(m)}</b><small>Promo {m.promotions?.numero ?? "—"}</small></span>
        </button>
      ))}
    </div>
  );
}

// le texte avec ses mentions cliquables (lien=false : simple mise en valeur,
// pour les cartes déjà entièrement cliquables)
export function TexteMentions({ texte, mentions, lien = true }) {
  if (!texte) return null;
  if (!mentions?.length) return texte;
  const noms = mentions.map((m) => ({ id: m.id, nom: nomComplet(m) })).filter((n) => n.nom).sort((a, b) => b.nom.length - a.nom.length);
  if (!noms.length) return texte;
  const re = new RegExp(`@(${noms.map((n) => n.nom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  const morceaux = [];
  let i = 0, m;
  while ((m = re.exec(texte))) {
    if (m.index > i) morceaux.push(texte.slice(i, m.index));
    const mb = noms.find((n) => n.nom === m[1]);
    morceaux.push(lien
      ? <Link key={m.index} href={`/profil/${mb.id}`} className="mention">@{m[1]}</Link>
      : <span key={m.index} className="mention">@{m[1]}</span>);
    i = m.index + m[0].length;
  }
  if (i < texte.length) morceaux.push(texte.slice(i));
  return morceaux;
}
