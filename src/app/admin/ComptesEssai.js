"use client";

import { useEffect, useMemo, useState } from "react";
import { texteErreur } from "@/lib/erreurs";
import { Search, X, UserPlus } from "lucide-react";
import Avatar from "@/components/Avatar";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { carnet, nomComplet } from "@/lib/mentions";
import { plat } from "@/components/Surligne";

// Les comptes de test des notifications (migration 70) : tant que le mode
// essai est actif, seuls les administrateurs et ces comptes reçoivent les
// push. Liste, ajout par recherche d'un membre validé, retrait d'un tap.
export default function ComptesEssai({ actif }) {
  const supabase = creerClientNavigateur();
  const [liste, setListe] = useState(null);
  const [membres, setMembres] = useState(null);
  const [q, setQ] = useState("");
  const [occupe, setOccupe] = useState(null);
  const [souci, setSouci] = useState("");
  const charger = () => supabase.rpc("admin_essai_comptes").then(({ data, error }) => { if (error) setSouci(texteErreur(error)); else setListe(data ?? []); });
  useEffect(() => { const t = setTimeout(charger, 0); return () => clearTimeout(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (q.trim() && membres === null) carnet().then(setMembres).catch(() => setMembres([])); }, [q, membres]);
  const resultats = useMemo(() => {
    const t = plat(q.trim());
    if (!t || !membres) return [];
    const deja = new Set((liste ?? []).map((c) => c.id));
    return membres.filter((m) => !deja.has(m.id) && plat(nomComplet(m)).includes(t)).slice(0, 6);
  }, [q, membres, liste]);
  const ajouter = async (m) => {
    setOccupe(m.id); setSouci("");
    const { error } = await supabase.rpc("admin_essai_ajouter", { p_profil: m.id });
    if (error) setSouci(texteErreur(error)); else { setQ(""); await charger(); }
    setOccupe(null);
  };
  const retirer = async (c) => {
    setOccupe(c.id); setSouci("");
    const { error } = await supabase.rpc("admin_essai_retirer", { p_profil: c.id });
    if (error) setSouci(texteErreur(error)); else await charger();
    setOccupe(null);
  };
  return (
    <div className="ce-bloc">
      <span style={{ fontSize: 13 }}>
        <b>Comptes de test</b>
        <span style={{ display: "block", color: "var(--brume)", fontSize: 12, lineHeight: 1.5, marginTop: 2 }}>
          {actif ? "Avec le mode essai actif, ils reçoivent les notifications comme les administrateurs : le comité informatique, les testeurs." : "Sans effet tant que le mode essai est éteint. Prépare la liste ici, active le mode au moment des essais."}
        </span>
      </span>
      <div className="ce-liste">
        {liste === null && !souci && <small style={{ color: "var(--brume)" }}>Chargement…</small>}
        {liste?.length === 0 && <small style={{ color: "var(--brume)" }}>Aucun compte de test pour l’instant.</small>}
        {liste?.map((c) => (
          <span key={c.id} className="ce-puce">
            <Avatar profil={{ prenom: c.prenom, nom: c.nom, photo: c.photo_url }} className="com-avatar" />
            {c.prenom} {c.nom}{c.promo ? <small> · P{c.promo}</small> : null}
            <button type="button" onClick={() => retirer(c)} disabled={occupe === c.id} aria-label={`Retirer ${c.prenom} ${c.nom}`}><X size={13} aria-hidden /></button>
          </span>
        ))}
      </div>
      <div className="msg-recherche ce-recherche">
        <Search size={15} strokeWidth={1.9} aria-hidden />
        <input className="saisie" placeholder="Ajouter un membre : tape son nom…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {resultats.length > 0 && (
        <div className="ce-resultats" role="listbox">
          {resultats.map((m) => (
            <button key={m.id} type="button" className="msg-personne" onClick={() => ajouter(m)} disabled={occupe === m.id}>
              <Avatar profil={{ prenom: m.prenom, nom: m.nom, photo: m.photo_url }} className="pub-avatar" />
              <span><b>{m.prenom} {m.nom}</b><small>Promo {m.promotions?.numero ?? m.promo ?? "?"}</small></span>
              <UserPlus size={16} aria-hidden style={{ marginLeft: "auto", color: "var(--bleu-texte)" }} />
            </button>
          ))}
        </div>
      )}
      {q.trim() && membres && resultats.length === 0 && <small style={{ color: "var(--brume)" }}>Personne ne correspond, ou déjà dans la liste.</small>}
      {souci && <p className="cp-souci" role="alert" style={{ margin: 0 }}>{souci}</p>}
    </div>
  );
}
