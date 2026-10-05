"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, X } from "lucide-react";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { texteErreur } from "@/lib/erreurs";
import { EVENEMENT, champsMinimum, manquesMinimum, oublierMoi } from "@/lib/profilComplet";
import ChoixPays from "@/components/ChoixPays";
import Photo from "@/app/mon-profil/Photo";

// La feuille « Dis aux anciens qui tu es » : s'ouvre à l'endroit même du geste
// quand le profil n'a pas le minimum (migration 84), ne montre que ce qui manque
// — photo avec recadrage, ligne de présentation, ville, pays — et reprend le geste
// interrompu sur « Enregistrer et continuer ». Montée une fois, dans la mise en
// page racine ; dort tant que personne ne l'appelle.
// « une photo, ta ville et une ligne sur toi » : seulement ce qui manque, dans l'ordre de la feuille
const MOTS = { photo_url: "une photo", statut_titre: "une ligne sur toi", ville: "ta ville", pays: "ton pays" };
const liste = (champs) => { const l = champs.map((c) => MOTS[c]); return l.length <= 1 ? l.join("") : l.slice(0, -1).join(", ") + " et " + l[l.length - 1]; };

export default function CompleterProfil() {
  const [demande, setDemande] = useState(null);     // { profil, termine, annule }
  const [profil, setProfil] = useState(null);
  const [etat, setEtat] = useState("");             // "" | envoi
  const [erreur, setErreur] = useState("");
  const [toast, setToast] = useState("");
  const [champs, setChamps] = useState([]);   // ce qui manquait à l'ouverture : la photo reste affichée une fois posée

  useEffect(() => {
    const ouvrir = (e) => {
      e.preventDefault();                           // « je m'en occupe » : la garde saura qu'un hôte écoute
      setChamps(manquesMinimum(e.detail.profil));
      setProfil({ ...e.detail.profil }); setErreur(""); setDemande(e.detail);
    };
    window.addEventListener(EVENEMENT, ouvrir);
    return () => window.removeEventListener(EVENEMENT, ouvrir);
  }, []);
  useEffect(() => {
    if (!demande) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; };
  }, [demande]);

  if (!demande || !profil) return null;
  const restants = manquesMinimum(profil);
  const signale = (m) => { setToast(m); setTimeout(() => setToast(""), 2500); };

  const fermer = (ok) => { const d = demande; setDemande(null); oublierMoi(); ok ? d.termine(profil) : d.annule(); };
  const enregistrer = async (e) => {
    e.preventDefault(); setErreur("");
    if (restants.length) { setErreur("Il manque encore " + restants.map((c) => ({ photo_url: "ta photo", statut_titre: "une ligne de présentation", ville: "ta ville", pays: "ton pays" })[c]).join(", ") + "."); return; }
    setEtat("envoi");
    try {
      const maj = {};
      for (const c of champs) if (c !== "photo_url") maj[c] = String(profil[c] ?? "").trim();
      if (Object.keys(maj).length) {
        const { error } = await creerClientNavigateur().from("profiles").update(maj).eq("id", profil.id);
        if (error) throw error;
      }
      fermer(true);
    } catch (err) { setErreur(texteErreur(err)); }
    finally { setEtat(""); }
  };

  return createPortal(
    <div className="dq" role="dialog" aria-modal="true" aria-labelledby="dq-titre">
      <div className="dq-voile" onClick={() => fermer(false)} />
      <form className="dq-feuille" onSubmit={enregistrer}>
        <header className="dq-tete">
          <div>
            <small className="dq-sur">Avant d’écrire aux anciens</small>
            <h2 id="dq-titre">Dis-leur qui tu es</h2>
          </div>
          <button type="button" className="dq-fermer" onClick={() => fermer(false)} aria-label="Plus tard"><X size={18} aria-hidden /></button>
        </header>
        <p className="dq-texte">
          Pour que les autres membres du réseau te reconnaissent, ajoute {liste(champs)}.
          C’est tout ce qu’il manque pour écrire, demander un contact et voir leurs coordonnées.
        </p>

        {champs.includes("photo_url") && (
          <div className="dq-champ dq-photo">
            <span className="dq-etiquette">Ta photo</span>
            <Photo profil={profil} onPhoto={(url) => setProfil((p) => ({ ...p, photo_url: url }))} signale={signale} />
          </div>
        )}
        {champs.includes("statut_titre") && (
          <div className="champ dq-champ">
            <label htmlFor="dq-titre-ligne">En une ligne (poste, école…)</label>
            <input id="dq-titre-ligne" className="saisie" placeholder="Ex. : Data scientist — M2 IA à Montréal" maxLength={120}
              value={profil.statut_titre ?? ""} onChange={(e) => setProfil((p) => ({ ...p, statut_titre: e.target.value }))} />
          </div>
        )}
        {champs.includes("ville") && (
          <div className="champ dq-champ">
            <label htmlFor="dq-ville">Ta ville</label>
            <input id="dq-ville" className="saisie" placeholder="Ex. : Ouagadougou" maxLength={80}
              value={profil.ville ?? ""} onChange={(e) => setProfil((p) => ({ ...p, ville: e.target.value }))} />
          </div>
        )}
        {champs.includes("pays") && (
          <div className="champ dq-champ">
            <label htmlFor="dq-pays">Ton pays</label>
            <ChoixPays id="dq-pays" valeur={profil.pays} onChange={(v) => setProfil((p) => ({ ...p, pays: v }))} obligatoire />
          </div>
        )}

        {erreur && <p role="alert" className="dq-erreur">{erreur}</p>}
        {toast && <p role="status" className="dq-toast">{toast}</p>}
        <footer className="dq-pied">
          <button type="button" className="btn btn-nu" onClick={() => fermer(false)}>Plus tard</button>
          <button type="submit" className="btn btn-or" disabled={etat === "envoi"}>
            {etat === "envoi" ? "Enregistrement…" : <>Enregistrer et continuer <ArrowRight size={16} aria-hidden /></>}
          </button>
        </footer>
        <small className="dq-note">Tu pourras tout retoucher ensuite dans Mon profil. {champsMinimum(profil).length === 3 ? "Élève : pas de ligne de présentation demandée." : ""}</small>
      </form>
    </div>,
    document.body
  );
}
