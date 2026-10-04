"use client";

import { useEffect, useState } from "react";
import { noterNavigationComplete } from "@/components/SuiviNavigation";
import { texteErreur, avecReprise } from "@/lib/erreurs";
import { useRouter } from "next/navigation";
import { X, Search, Users, Award, Check, Clock, Lock, Globe2, Briefcase } from "lucide-react";
import * as memoire from "@/lib/memoire";
import { groupesVisibles, rejoindreGroupe, retirerDemandeGroupe, ACCES } from "@/lib/messages";
import { VISIBILITES } from "@/lib/fil";
import useTempsReel from "@/lib/tempsReel";
import GlisserRafraichir from "@/components/GlisserRafraichir";

// L'annuaire des groupes qu'on peut rejoindre : ouverts (un tap) ou sur
// demande (le créateur accepte). Les groupes de l'amicale d'abord.
export default function Groupes({ enFeuille = false }) {
  const routeur = useRouter();
  const [q, setQ] = useState("");
  const [liste, setListe] = useState(() => memoire.lire("groupes.liste") ?? null);
  const [occupe, setOccupe] = useState(null);
  const [maintenant] = useState(() => Date.now());   // pour juger un refus récent (pas de Date.now() au rendu)
  const [toast, setToast] = useState("");
  const signale = (t) => { setToast(t); setTimeout(() => setToast(""), 2600); };
  const charger = async (recherche = q) => {
    try { const l = await avecReprise(() => groupesVisibles(recherche)); setListe(l); if (!recherche) memoire.ecrire("groupes.liste", l); }
    catch (e) { signale("Impossible de lire les groupes : " + texteErreur(e)); }
  };
  useEffect(() => { const t = setTimeout(() => charger(q), q ? 250 : 0); return () => clearTimeout(t); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  useTempsReel(["conversations", "groupe_demandes"], () => charger());

  const agir = async (g) => {
    setOccupe(g.id);
    try {
      if (g.ma_demande === "en_attente") { await retirerDemandeGroupe(g.id); signale("Demande retirée"); await charger(); }
      else {
        const r = await rejoindreGroupe(g.id);
        memoire.ecrire("conversations.liste", null);
        if (r === "membre") { signale(`Tu es dans « ${g.nom} »`); noterNavigationComplete(); if (enFeuille) window.location.assign(`/messages/${g.id}`); else routeur.push(`/messages/${g.id}`); }
        else { signale("Demande envoyée : le créateur du groupe la verra."); await charger(); }
      }
    } catch (e) { signaletexteErreur(e); }
    setOccupe(null);
  };

  const contenu = (
    <div className={`cp${enFeuille ? " cp-feuille" : ""}`}>
      <div className="msg-nc-haut">
        <header className="cp-tete">
          <button type="button" className="cp-fermer" onClick={() => routeur.back()} aria-label="Fermer"><X size={20} aria-hidden /></button>
          <span className="cp-titre">Découvrir des groupes</span>
        </header>
        <div className="msg-recherche">
          <Search size={16} strokeWidth={1.9} aria-hidden />
          <input className="saisie" placeholder="Rechercher un groupe…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="msg-carnet gr-liste">
        {liste === null && <p className="pu-vide">Chargement…</p>}
        {liste?.length === 0 && <p className="pu-vide">{q ? "Aucun groupe ne correspond." : "Aucun groupe à rejoindre pour l’instant. Ceux que tu crées peuvent être ouverts aux autres dans leurs réglages."}</p>}
        {liste?.map((g) => {
          const acces = ACCES.find((a) => a.cle === g.acces);
          const visi = VISIBILITES.find((v) => v.cle === g.visibilite);
          const refusRecent = g.ma_demande === "refusee" && g.refusee_le && maintenant - new Date(g.refusee_le).getTime() < 7 * 86400000;
          return (
            <div key={g.id} className="gr-carte">
              {g.photo_url ? <img src={g.photo_url} alt="" className="msg-vignette" /> : <span className="msg-vignette groupe" aria-hidden><Users size={20} /></span>}
              <span className="gr-corps">
                <span className="gr-haut">
                  {g.officiel && <span className="ev-officiel"><Award size={11} aria-hidden /> Amicale</span>}
                  <span className="gr-acces">{g.acces === "ouvert" ? <Globe2 size={11} aria-hidden /> : <Lock size={11} aria-hidden />} {acces?.nom}</span>
                  {visi && visi.cle !== "tous" && <span className="gr-acces"><Briefcase size={11} aria-hidden /> {visi.court}</span>}
                </span>
                <b>{g.nom}</b>
                {g.description && <small className="gr-desc">{g.description}</small>}
                <small className="gr-meta">{g.nb_membres} membre{g.nb_membres > 1 ? "s" : ""}{g.createur ? ` · créé par ${g.createur.prenom} ${g.createur.nom}` : ""}</small>
              </span>
              <button type="button" className={`btn ${g.ma_demande === "en_attente" ? "btn-nu" : "btn-or"} gr-bouton`} disabled={occupe === g.id || refusRecent}
                onClick={() => agir(g)} title={refusRecent ? "Demande refusée il y a moins d’une semaine" : ""}>
                {occupe === g.id ? "…" : g.ma_demande === "en_attente" ? <><Clock size={14} aria-hidden /> En attente</> : refusRecent ? "Refusée" : g.acces === "ouvert" ? <><Check size={14} aria-hidden /> Rejoindre</> : "Demander"}
              </button>
            </div>
          );
        })}
      </div>
      <div className={`toast${toast ? " la" : ""}`} role="status">{toast}</div>
    </div>
  );
  // en pleine page : glisser-rafraîchir ; en feuille, la feuille a son propre défilement
  return enFeuille ? contenu : <GlisserRafraichir onRafraichir={() => charger()}>{contenu}</GlisserRafraichir>;
}
