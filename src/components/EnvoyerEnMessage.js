"use client";

import { useEffect, useState } from "react";
import { texteErreur } from "@/lib/erreurs";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MessageCircle, PenLine, Users, X } from "lucide-react";
import Avatar from "@/components/Avatar";
import { mesConversations, nomConversation, envoyerLien } from "@/lib/messages";

// « Envoyer en message » : une offre, une publication ou un profil part dans
// une de mes conversations sous forme de carte (lien interne + titre).
// `chemin` = adresse interne (/offres/12), `titre` = ce qu'affichera la carte.
export default function EnvoyerEnMessage({ chemin, titre, className = "btn btn-nu", style, libelle = "Envoyer en message" }) {
  const routeur = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [liste, setListe] = useState(null);
  const [envoi, setEnvoi] = useState(null);
  const [toast, setToast] = useState("");
  useEffect(() => { if (ouvert && liste === null) mesConversations().then(setListe).catch(() => setListe([])); }, [ouvert, liste]);

  const envoyer = async (c) => {
    setEnvoi(c.id);
    try { await envoyerLien(c.id, chemin, titre); setOuvert(false); setToast(`Envoyé à ${nomConversation(c)}`); setTimeout(() => setToast(""), 2600); }
    catch (e) { setToast("Envoi impossible : " + texteErreur(e)); setTimeout(() => setToast(""), 2600); }
    setEnvoi(null);
  };

  return (
    <>
      <button type="button" className={className} style={style} onClick={() => setOuvert(true)}>
        <MessageCircle size={13} aria-hidden /> {libelle}
      </button>
      {ouvert && typeof document !== "undefined" && createPortal(
        <div className="fg-scrim msg-voile" role="presentation" onClick={() => setOuvert(false)}>
          <div className="msg-panneau" onClick={(e) => e.stopPropagation()}>
            <div className="msg-panneau-tete">
              <b>Envoyer à…</b>
              <button type="button" className="cp-fermer" onClick={() => setOuvert(false)} aria-label="Fermer"><X size={18} aria-hidden /></button>
            </div>
            <p className="msg-aide" style={{ padding: "0 10px 8px" }}>{titre}</p>
            <button type="button" className="msg-personne" onClick={() => routeur.push(`/messages/nouveau?lien=${encodeURIComponent(chemin)}&titre=${encodeURIComponent(titre ?? "")}`)}>
              <span className="msg-vignette groupe petite" aria-hidden><PenLine size={16} /></span>
              <span><b>Nouvelle conversation</b><small>choisir une personne ou créer un groupe</small></span>
            </button>
            {liste === null && <p className="pu-vide">Chargement…</p>}
            {liste?.map((c) => (
              <button key={c.id} type="button" className="msg-personne" disabled={envoi === c.id} onClick={() => envoyer(c)}>
                {c.type === "groupe"
                  ? <span className="msg-vignette groupe petite" aria-hidden><Users size={16} /></span>
                  : <Avatar profil={{ prenom: c.membres?.[0]?.prenom ?? "?", nom: c.membres?.[0]?.nom ?? "", photo: c.membres?.[0]?.photo_url }} className="pub-avatar" />}
                <span><b>{nomConversation(c)}</b><small>{c.type === "groupe" ? `${c.nb_membres} membres` : "conversation à deux"}</small></span>
              </button>
            ))}
          </div>
        </div>, document.body)}
      {toast && typeof document !== "undefined" && createPortal(<div className="toast la" role="status">{toast}</div>, document.body)}
    </>
  );
}
