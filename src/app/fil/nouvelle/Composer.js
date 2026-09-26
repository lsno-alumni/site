"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Camera, Clapperboard, Trash2, Globe2, Users, Briefcase, ChevronDown } from "lucide-react";
import Avatar from "@/components/Avatar";
import * as memoire from "@/lib/memoire";
import { publier as publierEnBase, VISIBILITES, VIDEO_SECONDES, VIDEO_MO, VIDEO_JOURS, PHOTOS_MAX } from "@/lib/fil";
import { useMentions, SuggestionsMention } from "@/lib/mentions";

const ICONES_VISI = { tous: Globe2, promo: Users, domaine: Briefcase };

const MAX = 1000;
// Vidéos : acceptées avec des bornes strictes, parce que le stockage et le
// débit sortant sont comptés sur le palier gratuit — 30 s, 20 Mo, et une
// durée de vie de 14 jours (la publication garde son texte ensuite). Les
// bornes vivent dans lib/fil.js, avec l'envoi.

// Le composer : le texte d'abord, des photos (jusqu'à PHOTOS_MAX) OU une
// vidéo en option, un seul bouton. Ouvert en feuille depuis le Fil (enFeuille) ou en pleine page.
// MAQUETTE (branche `social`) : rien n'est enregistré ; « Publier » ramène
// au Fil.
export default function Composer({ moi, enFeuille = false }) {
  const routeur = useRouter();
  const [texte, setTexte] = useState("");
  const [media, setMedia] = useState(null);   // vidéo : { type: "video", url, duree, fichier }
  const [photos, setPhotos] = useState([]);   // [{ url, fichier }]
  const [souci, setSouci] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [visibilite, setVisibilite] = useState("tous");
  const [choixVisi, setChoixVisi] = useState(false);
  const fichierPhoto = useRef(null);
  const fichierVideo = useRef(null);
  const champ = useRef(null);
  const mentions = useMentions(texte, (v) => setTexte(v.slice(0, MAX)), champ);

  const choisirPhoto = (e) => {
    const fichiers = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    e.target.value = "";
    if (!fichiers.length) return;
    const place = PHOTOS_MAX - photos.length;
    setSouci(fichiers.length > place ? `${PHOTOS_MAX} photos au maximum par publication.` : "");
    const ajout = fichiers.slice(0, Math.max(0, place)).map((f) => ({ url: URL.createObjectURL(f), fichier: f }));
    if (!ajout.length) return;
    if (media) { URL.revokeObjectURL(media.url); setMedia(null); }   // photos OU vidéo
    setPhotos((l) => [...l, ...ajout]);
  };
  const retirerPhoto = (i) => setPhotos((l) => { URL.revokeObjectURL(l[i].url); return l.filter((_, k) => k !== i); });
  const choisirVideo = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !f.type.startsWith("video/")) return;
    if (f.size > VIDEO_MO * 1024 * 1024) { setSouci(`Vidéo trop lourde (${Math.round(f.size / 1048576)} Mo). ${VIDEO_MO} Mo au maximum.`); return; }
    const url = URL.createObjectURL(f);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      if (v.duration > VIDEO_SECONDES + 0.5) { setSouci(`Vidéo trop longue (${Math.round(v.duration)} s). ${VIDEO_SECONDES} secondes au maximum.`); URL.revokeObjectURL(url); return; }
      setSouci("");
      photos.forEach((ph) => URL.revokeObjectURL(ph.url)); setPhotos([]);   // photos OU vidéo
      setMedia({ type: "video", url, duree: Math.round(v.duration), fichier: f });
    };
    v.onerror = () => { setSouci("Cette vidéo ne peut pas être lue ici."); URL.revokeObjectURL(url); };
    v.src = url;
  };
  const retirer = () => { if (media) URL.revokeObjectURL(media.url); setMedia(null); };
  const publier = async (e) => {
    e.preventDefault();
    if ((!texte.trim() && !media && !photos.length) || envoi) return;
    setEnvoi(true); setSouci("");
    try {
      await publierEnBase({ texte, media, photos: photos.map((ph) => ph.fichier), visibilite, mentions: mentions.idsPour(texte) });
      memoire.ecrire("fil.items", null);   // le Fil se rechargera avec la nouvelle publication en tête
      // en feuille, seul un retour arrière referme la feuille (une navigation
      // vers /fil laisserait le créneau parallèle sur son dernier état)
      if (enFeuille) routeur.back(); else routeur.push("/fil");
      routeur.refresh();
    } catch (err) {
      setSouci("Publication impossible : " + (err?.message ?? "réessaie dans un instant."));
      setEnvoi(false);
    }
  };
  const pret = (texte.trim().length > 0 || media || photos.length > 0) && !envoi;
  const IconeVisi = ICONES_VISI[visibilite];
  // le libellé nomme le cercle réel : « Promo 3 », « Informatique »
  const nomCercle = (cle) => cle === "promo" && moi.promo ? `Promo ${moi.promo}`
    : cle === "domaine" && moi.domaine ? moi.domaine
    : VISIBILITES.find((v) => v.cle === cle).nom;

  return (
    <form className={`cp${enFeuille ? " cp-feuille" : ""}`} onSubmit={publier}>
      <header className="cp-tete">
        <button type="button" className="cp-fermer" onClick={() => routeur.back()} aria-label="Annuler"><X size={20} aria-hidden /></button>
        <span className="cp-titre">Nouvelle publication</span>
        <button type="submit" className={`btn btn-or cp-publier${pret ? "" : " off"}`} disabled={!pret}>{envoi ? "Envoi…" : "Publier"}</button>
      </header>

      <div className="cp-qui">
        <Avatar profil={moi} className="pub-avatar" />
        <span>
          <b>{moi.prenom} {moi.nom}</b>
          <button type="button" className="cp-visi" onClick={() => setChoixVisi(!choixVisi)} aria-expanded={choixVisi}>
            <IconeVisi size={13} strokeWidth={2} aria-hidden /> {nomCercle(visibilite)} <ChevronDown size={13} aria-hidden />
          </button>
        </span>
      </div>
      {choixVisi && (
        <div className="cp-visi-liste" role="radiogroup" aria-label="Qui peut voir cette publication">
          {VISIBILITES.map((v) => {
            const I = ICONES_VISI[v.cle];
            return (
              <button key={v.cle} type="button" role="radio" aria-checked={visibilite === v.cle}
                className={`cp-visi-choix${visibilite === v.cle ? " on" : ""}`}
                onClick={() => { setVisibilite(v.cle); setChoixVisi(false); }}>
                <I size={18} strokeWidth={1.9} aria-hidden />
                <span><b>{nomCercle(v.cle)}</b><small>{v.aide}</small></span>
              </button>
            );
          })}
        </div>
      )}

      <textarea ref={champ} className="cp-texte" placeholder={"Une réussite, une question aux anciens, une photo de retrouvailles… (@ pour mentionner quelqu\u2019un)"}
        value={texte} onChange={mentions.surChangement} rows={enFeuille ? 5 : 6} autoFocus />
      <SuggestionsMention suggestions={mentions.suggestions} choisir={mentions.choisir} className="mention-liste-composer" />

      {photos.length > 0 && (
        <div className={`cp-photos${photos.length === 1 ? " seule" : ""}`}>
          {photos.map((ph, i) => (
            <div key={ph.url} className="cp-photo cp-photo-multi">
              <img src={ph.url} alt="" />
              <button type="button" className="cp-photo-retirer" onClick={() => retirerPhoto(i)} aria-label={`Retirer la photo ${i + 1}`}><Trash2 size={15} aria-hidden /></button>
            </div>
          ))}
          {photos.length < PHOTOS_MAX && (
            <button type="button" className="cp-photo-ajout" onClick={() => fichierPhoto.current?.click()} aria-label="Ajouter des photos">
              <Camera size={22} strokeWidth={1.8} aria-hidden /><small>{photos.length} / {PHOTOS_MAX}</small>
            </button>
          )}
        </div>
      )}
      {media && (
        <div className="cp-photo">
          <video src={media.url} controls playsInline preload="metadata" />
          <span className="cp-video-note">{media.duree} s · visible {VIDEO_JOURS} jours</span>
          <button type="button" className="cp-photo-retirer" onClick={retirer} aria-label="Retirer"><Trash2 size={15} aria-hidden /></button>
        </div>
      )}
      {souci && <p className="cp-souci" role="alert">{souci}</p>}

      <footer className="cp-pied">
        <button type="button" className="cp-outil" onClick={() => fichierPhoto.current?.click()}>
          <Camera size={18} strokeWidth={1.9} aria-hidden /> {photos.length ? "Ajouter" : "Photos"}
        </button>
        <button type="button" className="cp-outil" onClick={() => fichierVideo.current?.click()}>
          <Clapperboard size={18} strokeWidth={1.9} aria-hidden /> {media?.type === "video" ? "Changer" : "Vidéo"}
        </button>
        <input ref={fichierPhoto} type="file" accept="image/*" multiple hidden onChange={choisirPhoto} />
        <input ref={fichierVideo} type="file" accept="video/*" hidden onChange={choisirVideo} />
        <span className={`cp-compte${texte.length > MAX - 80 ? " proche" : ""}`}>{texte.length} / {MAX}</span>
      </footer>
    </form>
  );
}
