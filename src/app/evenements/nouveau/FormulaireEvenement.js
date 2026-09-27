"use client";

import { useRef, useState } from "react";
import { texteErreur } from "@/lib/erreurs";
import { useRouter } from "next/navigation";
import { X, Image as ImageIcon, Trash2, Globe2, Users, Briefcase, MapPin, Video, Calendar } from "lucide-react";
import Avatar from "@/components/Avatar";
import ChoixPays from "@/components/ChoixPays";
import { VISIBILITES } from "@/lib/fil";
import { creerEvenement, modifierEvenement, televerserAffiche, TITRE_MAX, DESCRIPTION_MAX } from "@/lib/evenements";

const ICONES_VISI = { tous: Globe2, promo: Users, domaine: Briefcase };

// « YYYY-MM-DDTHH:MM » local pour un <input type="datetime-local">
const versLocal = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const dansUneSemaine = () => { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(18, 0, 0, 0); return versLocal(d.toISOString()); };

// Organiser un événement (création, modification, ou copie d'un autre) :
// titre, date et heure, lieu (sur place ou en ligne), description, affiche,
// cercle de visibilité.
export default function FormulaireEvenement({ moi, initial = null, modifier = false, enFeuille = false }) {
  const routeur = useRouter();
  const [titre, setTitre] = useState(initial?.titre ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [debut, setDebut] = useState(initial?.debut ? versLocal(initial.debut) : dansUneSemaine());
  const [fin, setFin] = useState(initial?.fin ? versLocal(initial.fin) : "");
  const [lieuType, setLieuType] = useState(initial?.lieu_type ?? "sur_place");
  const [ville, setVille] = useState(initial?.ville ?? "");
  const [pays, setPays] = useState(initial?.pays || "BF");
  const [adresse, setAdresse] = useState(initial?.adresse ?? "");
  const [lien, setLien] = useState(initial?.lien ?? "");
  const [visibilite, setVisibilite] = useState(initial?.visibilite ?? "tous");
  const [affiche, setAffiche] = useState(initial?.affiche_chemin ? { chemin: initial.affiche_chemin, url: initial.afficheUrl } : null);
  const [envoi, setEnvoi] = useState(false);
  const [souci, setSouci] = useState("");
  const fichierRef = useRef(null);

  const choisirAffiche = (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f || !f.type.startsWith("image/")) return;
    setAffiche({ fichier: f, url: URL.createObjectURL(f) });
  };
  const pret = titre.trim().length >= 3 && debut && !envoi && (lieuType === "en_ligne" || ville.trim() || adresse.trim());
  const nomCercle = (cle) => cle === "promo" && moi.promo ? `Promo ${moi.promo}` : cle === "domaine" && moi.domaineNom ? moi.domaineNom : VISIBILITES.find((v) => v.cle === cle).nom;

  const envoyer = async (e) => {
    e.preventDefault();
    if (!pret) return;
    const dDebut = new Date(debut), dFin = fin ? new Date(fin) : null;
    if (dFin && dFin <= dDebut) { setSouci("La fin doit être après le début."); return; }
    if (!modifier && dDebut < new Date()) { setSouci("La date est déjà passée."); return; }
    setEnvoi(true); setSouci("");
    try {
      const chemin = affiche?.fichier ? await televerserAffiche(affiche.fichier) : (affiche?.chemin ?? null);
      const champs = {
        titre: titre.trim(), description: description.trim(), debut: dDebut.toISOString(), fin: dFin ? dFin.toISOString() : null,
        lieu_type: lieuType, ville: lieuType === "en_ligne" ? "" : ville.trim(), pays: lieuType === "en_ligne" ? "" : (pays ?? ""),
        adresse: lieuType === "en_ligne" ? "" : adresse.trim(), lien: lieuType === "en_ligne" ? lien.trim() : "",
        affiche_chemin: chemin, visibilite,
      };
      let id = initial?.id;
      if (modifier) await modifierEvenement(id, champs); else id = await creerEvenement(champs);
      if (enFeuille) routeur.replace(`/evenements/${id}`); else window.location.assign(`/evenements/${id}`);
    } catch (err) { setSouci("Impossible d’enregistrer : " + texteErreur(err)); setEnvoi(false); }
  };

  return (
    <form className={`cp ev-form${enFeuille ? " cp-feuille" : ""}`} onSubmit={envoyer}>
      <header className="cp-tete">
        <button type="button" className="cp-fermer" onClick={() => routeur.back()} aria-label="Annuler"><X size={20} aria-hidden /></button>
        <span className="cp-titre">{modifier ? "Modifier l’événement" : "Organiser un événement"}</span>
        <button type="submit" className={`btn btn-or cp-publier${pret ? "" : " off"}`} disabled={!pret}>{envoi ? "Envoi…" : modifier ? "Enregistrer" : "Publier"}</button>
      </header>

      <div className="cp-qui">
        <Avatar profil={moi} className="pub-avatar" />
        <span>
          <b>{moi.prenom} {moi.nom}</b>
          <small style={{ display: "block", color: "var(--brume)", fontSize: 12 }}>{moi.role === "admin" || moi.role === "delegue" ? "Événement de l’amicale" : "Organisateur"}</small>
        </span>
      </div>

      <div className="ev-champs">
        <input className="qa-form-titre" type="text" value={titre} maxLength={TITRE_MAX} placeholder="Le titre : Dîner de la promo 3, Visio orientation…" onChange={(e) => setTitre(e.target.value)} autoFocus={!modifier} />

        <div className="ev-ligne">
          <label className="ev-label"><Calendar size={14} aria-hidden /> Début<input type="datetime-local" value={debut} onChange={(e) => setDebut(e.target.value)} required /></label>
          <label className="ev-label">Fin <small>(facultatif)</small><input type="datetime-local" value={fin} min={debut} onChange={(e) => setFin(e.target.value)} /></label>
        </div>

        <div className="ev-lieu-type" role="radiogroup" aria-label="Où">
          <button type="button" role="radio" aria-checked={lieuType === "sur_place"} className={`puce${lieuType === "sur_place" ? " active" : ""}`} onClick={() => setLieuType("sur_place")}><MapPin size={13} aria-hidden /> Sur place</button>
          <button type="button" role="radio" aria-checked={lieuType === "en_ligne"} className={`puce${lieuType === "en_ligne" ? " active" : ""}`} onClick={() => setLieuType("en_ligne")}><Video size={13} aria-hidden /> En ligne</button>
        </div>
        {lieuType === "sur_place" ? (
          <>
            <div className="ev-ligne">
              <input type="text" value={ville} maxLength={80} placeholder="Ville" onChange={(e) => setVille(e.target.value)} />
              <ChoixPays id="ev-pays" valeur={pays} onChange={setPays} />
            </div>
            <input type="text" value={adresse} maxLength={200} placeholder="Adresse ou repère : Maquis Le Verdoyant, face à la BCEAO…" onChange={(e) => setAdresse(e.target.value)} />
          </>
        ) : (
          <input type="url" value={lien} maxLength={300} placeholder="Lien de la visio (Meet, Zoom, Teams…)" onChange={(e) => setLien(e.target.value)} />
        )}

        <textarea className="cp-texte ev-description" rows={5} value={description} maxLength={DESCRIPTION_MAX} placeholder="Le programme, ce qu’il faut apporter, la participation aux frais…" onChange={(e) => setDescription(e.target.value)} />

        {affiche ? (
          <div className="cp-photo ev-affiche-apercu">
            <img src={affiche.url} alt="" />
            <button type="button" className="cp-photo-retirer" onClick={() => { if (affiche.fichier) URL.revokeObjectURL(affiche.url); setAffiche(null); }} aria-label="Retirer l’affiche"><Trash2 size={15} aria-hidden /></button>
          </div>
        ) : (
          <button type="button" className="cp-outil" onClick={() => fichierRef.current?.click()}><ImageIcon size={18} strokeWidth={1.9} aria-hidden /> Ajouter une affiche</button>
        )}
        <input ref={fichierRef} type="file" accept="image/*" hidden onChange={choisirAffiche} />

        <div className="cp-visi-liste" role="radiogroup" aria-label="Qui peut voir cet événement" style={{ margin: 0 }}>
          {VISIBILITES.map((v) => { const I = ICONES_VISI[v.cle]; return (
            <button key={v.cle} type="button" role="radio" aria-checked={visibilite === v.cle} className={`cp-visi-choix${visibilite === v.cle ? " on" : ""}`} onClick={() => setVisibilite(v.cle)}>
              <I size={18} strokeWidth={1.9} aria-hidden /><span><b>{nomCercle(v.cle)}</b><small>{v.aide}</small></span>
            </button>); })}
        </div>
        {souci && <p className="cp-souci" role="alert" style={{ margin: 0 }}>{souci}</p>}
      </div>
    </form>
  );
}
