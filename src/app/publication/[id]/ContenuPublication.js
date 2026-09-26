"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCircle, Share2 } from "lucide-react";
import Avatar from "@/components/Avatar";
import Bravo from "@/components/Bravo";
import Commentaires from "@/components/Commentaires";
import { depuis, urlMedia, VISIBILITES } from "@/lib/fil";

// Une publication ouverte (page /publication/[id] ET feuille glissante depuis
// le Fil). TetePublication (auteur + texte, zone glissable, purement visuelle)
// puis SuitePublication (média, actions, commentaires, saisie — interactive).

export function TetePublication({ p }) {
  return (
    <div className="pu-tete">
      <Link href={`/profil/${p.auteur.id}`} className="pub-qui">
        <Avatar profil={{ prenom: p.auteur.prenom, nom: p.auteur.nom, photo: p.auteur.photo_url }} className="pub-avatar" />
        <span>
          <b>{p.auteur.prenom} {p.auteur.nom}</b>
          <small>Promo {p.auteur.promo} · {depuis(p.cree_le)}
            {p.visibilite && p.visibilite !== "tous" && <span className="pub-visi">{VISIBILITES.find((v) => v.cle === p.visibilite)?.court}</span>}</small>
        </span>
      </Link>
      {p.texte && <p className="pu-texte">{p.texte}</p>}
    </div>
  );
}

export function SuitePublication({ p, commentaires, moi, moderateur, enFeuille = false }) {
  const [nb, setNb] = useState(commentaires?.filter((c) => !c.masque).length ?? p.commentaires ?? 0);
  const partager = async () => {
    const url = `${window.location.origin}/publication/${p.id}`;
    try {
      if (navigator.share) await navigator.share({ title: `${p.auteur.prenom} sur LSNO Amicale`, url });
      else await navigator.clipboard.writeText(url);
    } catch { /* annulé */ }
  };
  return (
    <>
      {p.media_type === "photo" && p.media_chemin && <img className="pu-photo" src={urlMedia(p.media_chemin)} alt="" />}
      {p.media_type === "video" && p.media_chemin && (
        <video className="pu-video" src={urlMedia(p.media_chemin)} controls playsInline preload="metadata" />
      )}
      {p.media_type === "video_expiree" && <p className="pub-expiree" style={{ margin: "14px 22px 0" }}>Vidéo expirée (les vidéos restent 14 jours).</p>}
      <div className="pub-pied pu-actions">
        <Bravo type="publication" id={p.id} nombre={p.bravos} actif={p.jai_bravo} />
        <span className="pub-action" style={{ cursor: "default" }}>
          <MessageCircle size={16} strokeWidth={1.9} aria-hidden /> {nb} commentaire{nb > 1 ? "s" : ""}
        </span>
        <button type="button" className="pub-action" aria-label="Partager" onClick={partager}><Share2 size={16} strokeWidth={1.9} aria-hidden /></button>
      </div>
      <Commentaires type="publication" id={p.id} moi={moi} initial={commentaires} onNombre={setNb} moderateur={moderateur} fixe={enFeuille} />
    </>
  );
}

export default function ContenuPublication({ p, commentaires, moi, moderateur }) {
  return (
    <>
      <TetePublication p={p} />
      <SuitePublication p={p} commentaires={commentaires} moi={moi} moderateur={moderateur} />
    </>
  );
}
