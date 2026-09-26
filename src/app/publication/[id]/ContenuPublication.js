"use client";

import { useState } from "react";
import Link from "next/link";
import { ThumbsUp, MessageCircle, Share2, Send, CornerDownRight } from "lucide-react";
import Avatar from "@/components/Avatar";

// Une publication ouverte (page /publication/[id] ET feuille glissante depuis
// le Fil). Même découpe que profils et offres : TetePublication (auteur +
// texte, zone glissable, purement visuelle) puis SuitePublication (photo,
// actions, commentaires, saisie — interactive).
//
// MAQUETTE (branche `social`) : données de démonstration.

export function TetePublication({ p }) {
  return (
    <div className="pu-tete">
      <div className="pub-qui">
        <Avatar profil={{ prenom: p.auteur.prenom, nom: p.auteur.nom, photo: p.auteur.photo }} className="pub-avatar" />
        <span>
          <b>{p.auteur.prenom} {p.auteur.nom}</b>
          <small>Promo {p.auteur.promo} · {p.il_y_a}</small>
        </span>
      </div>
      <p className="pu-texte">{p.texte}</p>
    </div>
  );
}

function Commentaire({ c, parent, onRepondre }) {
  return (
    <div className={`com${c.reponse_a ? " com-reponse" : ""}`}>
      <Link href={`/profil/${c.auteur.id}`}>
        <Avatar profil={{ prenom: c.auteur.prenom, nom: c.auteur.nom, photo: c.auteur.photo }} className="com-avatar" />
      </Link>
      <div className="com-corps">
        <div className="com-bulle">
          <b>{c.auteur.prenom} {c.auteur.nom}</b>
          {parent && <small className="com-vers"><CornerDownRight size={11} aria-hidden /> en réponse à {parent.auteur.prenom}</small>}
          <p>{c.texte}</p>
        </div>
        <div className="com-meta">
          <span>{c.il_y_a}</span>
          <button type="button" onClick={() => onRepondre(c)}>Répondre</button>
        </div>
      </div>
    </div>
  );
}

export function SuitePublication({ p, commentaires, moi }) {
  const [bravo, setBravo] = useState(p.jai_bravo);
  const [texte, setTexte] = useState("");
  const [reponseA, setReponseA] = useState(null);
  const n = p.bravos + (bravo ? 1 : 0) - (p.jai_bravo ? 1 : 0);
  return (
    <>
      {p.photo && <img className="pu-photo" src={p.photo} alt="" />}
      <div className="pub-pied pu-actions">
        <button type="button" className={`pub-action${bravo ? " on" : ""}`} onClick={() => setBravo(!bravo)} aria-pressed={bravo}>
          <ThumbsUp size={16} strokeWidth={bravo ? 2.4 : 1.9} aria-hidden /> Bravo{n > 0 && <b>{n}</b>}
        </button>
        <span className="pub-action" style={{ cursor: "default" }}>
          <MessageCircle size={16} strokeWidth={1.9} aria-hidden /> {commentaires.length} commentaire{commentaires.length > 1 ? "s" : ""}
        </span>
        <button type="button" className="pub-action" aria-label="Partager"><Share2 size={16} strokeWidth={1.9} aria-hidden /></button>
      </div>

      <section className="pu-commentaires">
        {commentaires.length === 0 && <p className="pu-vide">Sois le premier à répondre.</p>}
        {commentaires.map((c) => (
          <Commentaire key={c.id} c={c} parent={c.reponse_a ? commentaires.find((x) => x.id === c.reponse_a) : null}
            onRepondre={(x) => { setReponseA(x); document.getElementById("com-saisie")?.focus(); }} />
        ))}
      </section>

      {/* la saisie reste collée en bas de la feuille / de la page */}
      <form className="com-saisie" onSubmit={(e) => { e.preventDefault(); setTexte(""); setReponseA(null); }}>
        {reponseA && (
          <div className="com-saisie-vers">
            <CornerDownRight size={12} aria-hidden /> Réponse à {reponseA.auteur.prenom}
            <button type="button" onClick={() => setReponseA(null)} aria-label="Annuler la réponse">×</button>
          </div>
        )}
        <div className="com-saisie-ligne">
          <Avatar profil={moi} className="com-avatar" />
          <input id="com-saisie" className="saisie" placeholder={reponseA ? `Répondre à ${reponseA.auteur.prenom}…` : "Écrire un commentaire…"}
            value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={600} />
          <button type="submit" className="com-envoyer" disabled={!texte.trim()} aria-label="Envoyer"><Send size={17} aria-hidden /></button>
        </div>
      </form>
    </>
  );
}

export default function ContenuPublication({ p, commentaires, moi }) {
  return (
    <>
      <TetePublication p={p} />
      <SuitePublication p={p} commentaires={commentaires} moi={moi} />
    </>
  );
}
