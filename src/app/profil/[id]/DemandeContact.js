"use client";

import { useEffect, useState } from "react";
import { texteErreur } from "@/lib/erreurs";
import { Send, Check, Share2, MessageCircle } from "lucide-react";
import { creerClientNavigateur } from "@/lib/supabase/client";

// Boutons d'action du profil : « Demander le contact » (mise en relation)
// + « Partager » (partage natif du lien). Le statut de la demande vient
// du serveur ; un refus s'affiche comme « envoyée » (silence poli).
export default function DemandeContact({ cibleId, prenom, statutInitial, aSurDemande }) {
  const supabase = creerClientNavigateur();
  const [statut, setStatut] = useState(statutInitial); // null | attente | acceptee | refusee
  const [formulaire, setFormulaire] = useState(false);
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  const envoyer = async () => {
    setEnCours(true);
    setErreur("");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("demandes_contact").insert({
      demandeur: user.id,
      cible: cibleId,
      message: message.trim() || null,
    });
    setEnCours(false);
    if (error) {
      setErreur("Envoi impossible : " + texteErreur(error));
      return;
    }
    setStatut("attente");
    setFormulaire(false);
  };

  const [bloque, setBloque] = useState(null);   // null = pas encore su
  useEffect(() => {
    import("@/lib/messages").then(({ mesBlocages }) => mesBlocages().then((l) => setBloque(l.includes(cibleId))).catch(() => setBloque(false)));
  }, [cibleId]);
  const basculerBlocage = async () => {
    try {
      const { bloquer, debloquer } = await import("@/lib/messages");
      if (bloque) { await debloquer(cibleId); setBloque(false); setErreur("Membre débloqué"); }
      else { if (!confirm(`Bloquer ${prenom} ? Plus de conversation possible entre vous, ses messages disparaissent de ta vue.`)) return; await bloquer(cibleId); setBloque(true); setErreur("Membre bloqué"); }
      setTimeout(() => setErreur(""), 2500);
    } catch (e) { setErreur("Impossible : " + texteErreur(e)); setTimeout(() => setErreur(""), 3000); }
  };
  const ecrire = async () => {
    try {
      const { ouvrirDuo } = await import("@/lib/messages");
      const cid = await ouvrirDuo(cibleId);
      window.location.assign(`/messages/${cid}`);
    } catch (e) { setErreur("Impossible d'ouvrir la conversation : " + texteErreur(e)); setTimeout(() => setErreur(""), 3000); }
  };
  const partager = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: `${prenom} — LSNO Amicale`, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      setErreur("Lien copié ✓");
      setTimeout(() => setErreur(""), 2000);
    }
  };

  return (
    <>
      <div className="p-actions">
        {aSurDemande && statut === null && !formulaire && (
          <button className="btn btn-or" style={{ flex: 1 }} onClick={() => setFormulaire(true)}>
            Demander le contact
          </button>
        )}
        {aSurDemande && statut === "acceptee" && (
          <span className="btn btn-nu" style={{ flex: 1, cursor: "default", color: "#9FD8B4" }}>
            <Check size={15} aria-hidden /> Contact partagé
          </span>
        )}
        {aSurDemande && (statut === "attente" || statut === "refusee") && (
          <span className="btn btn-nu" style={{ flex: 1, cursor: "default" }}>
            <Check size={15} aria-hidden /> Demande envoyée
          </span>
        )}
        <button className="btn btn-nu" onClick={ecrire}>
          <MessageCircle size={15} aria-hidden /> Message
        </button>
        <button className="btn btn-nu" onClick={partager}>
          <Share2 size={15} aria-hidden /> Partager
        </button>
      </div>

      {bloque !== null && (
        <button type="button" className="p-bloquer" onClick={basculerBlocage}>
          {bloque ? "Débloquer ce membre" : "Bloquer ce membre"}
        </button>
      )}

      {formulaire && (
        <div className="f-corps" style={{ paddingTop: 0, paddingBottom: 10 }}>
          <div className="champ">
            <label htmlFor="msg-demande">Un mot pour {prenom} (optionnel)</label>
            <textarea
              id="msg-demande"
              className="saisie"
              rows={2}
              maxLength={300}
              placeholder="Ex. : Promo 7, je vise ta filière — j'aimerais échanger."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-or" style={{ flex: 1, padding: "10px 16px", fontSize: 13.5 }} onClick={envoyer} disabled={enCours}>
              <Send size={14} aria-hidden /> {enCours ? "Envoi…" : "Envoyer la demande"}
            </button>
            <button className="btn btn-nu" style={{ padding: "10px 16px", fontSize: 13.5 }} onClick={() => setFormulaire(false)}>Annuler</button>
          </div>
        </div>
      )}
      {erreur && (
        <p role="status" style={{ padding: "0 24px 8px", fontSize: 12.5, color: erreur.includes("✓") ? "#9FD8B4" : "var(--rouge)" }}>
          {erreur}
        </p>
      )}
    </>
  );
}
