"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Camera, Trash2 } from "lucide-react";
import Avatar from "@/components/Avatar";

const MAX = 1000;

// Le composer : le texte d'abord, la photo en option, un seul bouton.
// MAQUETTE (branche `social`) : rien n'est enregistré ; « Publier » ramène
// au Fil.
export default function Composer({ moi }) {
  const routeur = useRouter();
  const [texte, setTexte] = useState("");
  const [photo, setPhoto] = useState(null);   // URL locale d'aperçu
  const champ = useRef(null);
  const fichier = useRef(null);

  const choisir = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !f.type.startsWith("image/")) return;
    setPhoto(URL.createObjectURL(f));
  };
  const publier = (e) => {
    e.preventDefault();
    if (!texte.trim() && !photo) return;
    routeur.push("/fil");
  };
  const pret = texte.trim().length > 0 || photo;

  return (
    <form className="cp" onSubmit={publier}>
      <header className="cp-tete">
        <button type="button" className="cp-fermer" onClick={() => routeur.back()} aria-label="Annuler"><X size={20} aria-hidden /></button>
        <span className="cp-titre">Nouvelle publication</span>
        <button type="submit" className={`btn btn-or cp-publier${pret ? "" : " off"}`} disabled={!pret}>Publier</button>
      </header>

      <div className="cp-qui">
        <Avatar profil={moi} className="pub-avatar" />
        <span>
          <b>{moi.prenom} {moi.nom}</b>
          <small>Promo {moi.promo ?? "—"} · visible par tous les membres</small>
        </span>
      </div>

      <textarea ref={champ} className="cp-texte" placeholder="Une réussite, une question aux anciens, une photo de retrouvailles…"
        value={texte} onChange={(e) => setTexte(e.target.value.slice(0, MAX))} rows={6} autoFocus />

      {photo && (
        <div className="cp-photo">
          <img src={photo} alt="" />
          <button type="button" className="cp-photo-retirer" onClick={() => setPhoto(null)} aria-label="Retirer la photo"><Trash2 size={15} aria-hidden /></button>
        </div>
      )}

      <footer className="cp-pied">
        <button type="button" className="cp-outil" onClick={() => fichier.current?.click()}>
          <Camera size={18} strokeWidth={1.9} aria-hidden /> {photo ? "Changer la photo" : "Ajouter une photo"}
        </button>
        <input ref={fichier} type="file" accept="image/*" hidden onChange={choisir} />
        <span className={`cp-compte${texte.length > MAX - 80 ? " proche" : ""}`}>{texte.length} / {MAX}</span>
      </footer>
    </form>
  );
}
