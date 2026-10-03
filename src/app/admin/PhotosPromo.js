"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Trash2, Check, Loader2 } from "lucide-react";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { texteErreur } from "@/lib/erreurs";
import { listeCarrousel, srcPhoto, televerserPhotoCarrousel, enregistrerPhotoCarrousel, retirerPhotoCarrousel, TITRE_MAX } from "@/lib/carrousel";

// « Photos de ma promo » : les deux emplacements d'une promotion dans le
// carrousel d'À propos. Un délégué tient ceux de sa promotion ; un admin choisit
// la promotion. Ajouter ou remplacer (la photo est réduite sur le téléphone
// avant l'envoi), retitrer, retirer — chaque geste va au journal.
export default function PhotosPromo({ moi }) {
  const [liste, setListe] = useState(null);
  const [promo, setPromo] = useState(moi?.role === "admin" ? null : moi?.promotion_id ?? null);
  const [souci, setSouci] = useState("");
  const [avis, setAvis] = useState("");   // « Photo enregistrée », « Photo retirée » — porté ici : l'emplacement se remonte après chaque geste
  const minuteurAvis = useRef(null);
  const confirmer = async (texte) => { await charger(); setAvis(texte); clearTimeout(minuteurAvis.current); minuteurAvis.current = setTimeout(() => setAvis(""), 2200); };
  const charger = async () => {
    try { const l = await listeCarrousel(creerClientNavigateur()); setListe(l); if (!promo && moi?.role === "admin") setPromo(l.promotions[0]?.id ?? null); }
    catch (e) { setSouci(texteErreur(e)); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { charger(); }, []);
  if (souci) return <p className="pu-vide">{souci}</p>;
  if (!liste) return <p style={{ color: "var(--brume)", fontSize: 14 }}>Chargement…</p>;
  const promotion = liste.promotions.find((p) => p.id === promo);
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <p style={{ fontSize: 13.5, color: "var(--texte-2)", margin: 0, lineHeight: 1.55 }}>
        Deux photos par promotion, visibles par tous dans « Le lycée, en images » de la page À propos, après celles du lycée.
        Choisis des photos où chacun est d&apos;accord d&apos;apparaître.
      </p>
      {moi?.role === "admin" && (
        <div className="champ">
          <label htmlFor="promo-carrousel">Promotion</label>
          <select id="promo-carrousel" className="saisie" value={promo ?? ""} onChange={(e) => setPromo(Number(e.target.value))}>
            {liste.promotions.map((p) => <option key={p.id} value={p.id}>Promo {p.numero} · bac {p.annee_bac}</option>)}
          </select>
        </div>
      )}
      {promotion && (
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
          {[1, 2].map((position) => (
            <Emplacement key={`${promotion.id}-${position}-${liste.photos.find((p) => p.promotion_id === promotion.id && p.position === position)?.maj_le ?? "vide"}`} promotion={promotion} position={position}
              photo={liste.photos.find((p) => p.promotion_id === promotion.id && p.position === position) ?? null} onChange={confirmer} />
          ))}
        </div>
      )}
      {avis && <p role="status" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--vert-ok)", fontSize: 14, margin: 0 }}><Check size={16} aria-hidden /> {avis}</p>}
    </div>
  );
}

function Emplacement({ promotion, position, photo, onChange }) {
  const [titre, setTitre] = useState(photo?.titre ?? "");
  const [fichier, setFichier] = useState(null);        // nouvelle photo choisie, pas encore envoyée
  const [apercu, setApercu] = useState(null);
  const [etat, setEtat] = useState("");                 // "" | "envoi"
  const [erreur, setErreur] = useState("");
  const entree = useRef(null);
  useEffect(() => () => { if (apercu) URL.revokeObjectURL(apercu); }, [apercu]);

  const choisir = (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) { setErreur("Choisis une image."); return; }
    setErreur(""); setFichier(f); setApercu(URL.createObjectURL(f));
    if (!titre.trim()) setTitre(`Promo ${promotion.numero}`);
  };
  const enregistrer = async () => {
    const t = titre.trim();
    if (!t) { setErreur("Donne un titre à la photo."); return; }
    if (!photo && !fichier) { setErreur("Choisis d'abord une photo."); return; }
    setEtat("envoi"); setErreur("");
    const supabase = creerClientNavigateur();
    try {
      const chemin = fichier ? await televerserPhotoCarrousel(supabase, promotion.id, position, fichier) : photo.chemin;
      await enregistrerPhotoCarrousel(supabase, promotion.id, position, chemin, t);
      setEtat("");
      await onChange(fichier ? "Photo enregistrée" : "Titre enregistré");
    } catch (e) { setEtat(""); setErreur(texteErreur(e)); }
  };
  const retirer = async () => {
    if (!photo || !window.confirm("Retirer cette photo du carrousel ?")) return;
    setEtat("envoi"); setErreur("");
    try { await retirerPhotoCarrousel(creerClientNavigateur(), promotion.id, position); setEtat(""); await onChange("Photo retirée"); }
    catch (e) { setEtat(""); setErreur(texteErreur(e)); }
  };
  const image = apercu ?? (photo ? srcPhoto(photo) : null);
  const modifie = !!fichier || (photo && titre.trim() !== photo.titre);
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <button type="button" onClick={() => entree.current?.click()} aria-label={photo ? `Remplacer la photo ${position}` : `Ajouter la photo ${position}`}
        style={{ position: "relative", aspectRatio: "4 / 3", borderRadius: 14, overflow: "hidden", border: image ? "0" : "1.5px dashed var(--ligne)", background: image ? "var(--carte)" : "rgba(var(--texte-rgb), .05)", display: "grid", placeItems: "center", color: "var(--brume)", cursor: "pointer", padding: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {image ? <img src={image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <span style={{ display: "grid", placeItems: "center", gap: 6, fontSize: 12.5 }}><Camera size={22} aria-hidden /> Photo {position}</span>}
        {image && <span style={{ position: "absolute", right: 8, bottom: 8, background: "rgba(20,26,38,.75)", color: "#fff", borderRadius: 100, padding: "5px 9px", fontSize: 11.5, display: "flex", gap: 5, alignItems: "center" }}><Camera size={13} aria-hidden /> Remplacer</span>}
      </button>
      <input ref={entree} type="file" accept="image/*" hidden onChange={choisir} />
      <input type="text" className="saisie" placeholder={`Titre (ex. Promo ${promotion.numero})`} maxLength={TITRE_MAX} value={titre} onChange={(e) => setTitre(e.target.value)} aria-label={`Titre de la photo ${position}`} style={{ fontSize: 14 }} />
      {erreur && <p role="alert" style={{ color: "var(--rouge)", fontSize: 12.5, margin: 0 }}>{erreur}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn btn-or" disabled={etat === "envoi" || !modifie} onClick={enregistrer} style={{ flex: 1, padding: "9px 10px", fontSize: 13.5, opacity: etat === "envoi" || !modifie ? 0.6 : 1 }}>
          {etat === "envoi" && <Loader2 size={15} className="tourne" aria-hidden />}
          {fichier ? " Envoyer" : " Enregistrer"}
        </button>
        {photo && <button type="button" className="btn btn-nu" onClick={retirer} disabled={etat === "envoi"} aria-label={`Retirer la photo ${position}`} style={{ padding: "9px 10px" }}><Trash2 size={15} aria-hidden /></button>}
      </div>
    </div>
  );
}
