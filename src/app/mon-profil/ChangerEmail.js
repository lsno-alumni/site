"use client";

import { useEffect, useState } from "react";
import { AtSign, MailCheck } from "lucide-react";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { texteErreur } from "@/lib/erreurs";

// Changer soi-même son adresse de connexion (jusqu'ici, seul un admin le
// pouvait, en base, sans rien envoyer au membre). Supabase Auth envoie le
// modèle « Changement d'email » : un lien vers la nouvelle adresse et, par
// sécurité, un autre vers l'ancienne ; l'adresse ne change qu'une fois les
// liens cliqués. Le lien ramène sur Mon profil (?email=confirme).
export default function ChangerEmail() {
  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [etat, setEtat] = useState("");   // "" | "envoi" | "envoye" | "confirme"
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    const supabase = creerClientNavigateur();
    supabase.auth.getUser().then(({ data }) => { if (data?.user?.email) setActuel(data.user.email); });
    if (new URLSearchParams(window.location.search).get("email") === "confirme") {
      setTimeout(() => setEtat("confirme"), 0);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const envoyer = async (e) => {
    e.preventDefault();
    const adresse = nouveau.trim().toLowerCase();
    if (!adresse || adresse === actuel) { setErreur(adresse ? "C'est déjà ton adresse actuelle." : "Indique la nouvelle adresse."); return; }
    setEtat("envoi"); setErreur("");
    const supabase = creerClientNavigateur();
    const { error } = await supabase.auth.updateUser({ email: adresse }, { emailRedirectTo: `${window.location.origin}/mon-profil?email=confirme` });
    if (error) { setEtat(""); setErreur(texteErreur(error)); return; }
    setEtat("envoye");
  };

  return (
    <details className="bloc-notif" style={{ marginTop: 16 }}>
      <summary style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 600 }}>
        <AtSign size={17} strokeWidth={1.9} aria-hidden style={{ color: "var(--bleu-texte)" }} />
        Adresse email de connexion
      </summary>
      <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
        {etat === "confirme" && (
          <p style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 14, lineHeight: 1.5, color: "var(--vert-ok)" }}>
            <MailCheck size={18} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} /> Ta nouvelle adresse est confirmée : c&apos;est désormais celle qui sert à te connecter.
          </p>
        )}
        <p style={{ fontSize: 14, color: "var(--texte-2)", margin: 0, lineHeight: 1.5 }}>
          Adresse actuelle : <b style={{ color: "var(--texte)", overflowWrap: "anywhere" }}>{actuel || "…"}</b>
        </p>
        {etat === "envoye" ? (
          <p style={{ fontSize: 14, lineHeight: 1.55, margin: 0 }}>
            Un lien de confirmation part vers <b>{nouveau.trim().toLowerCase()}</b> et, par sécurité, un autre vers ton adresse actuelle.
            Le changement prend effet quand les liens ont été cliqués. Pense aux spams.
          </p>
        ) : (
          <form onSubmit={envoyer} style={{ display: "grid", gap: 10 }}>
            <div className="champ">
              <label htmlFor="nouvel-email">Nouvelle adresse</label>
              <input id="nouvel-email" type="email" className="saisie" required autoComplete="email" value={nouveau} onChange={(e) => setNouveau(e.target.value)} />
            </div>
            {erreur && <p role="alert" style={{ color: "var(--rouge)", fontSize: 13, margin: 0 }}>{erreur}</p>}
            <button type="submit" className="btn btn-nu" disabled={etat === "envoi"} style={{ opacity: etat === "envoi" ? 0.6 : 1 }}>
              {etat === "envoi" ? "Envoi…" : "Envoyer la confirmation"}
            </button>
          </form>
        )}
      </div>
    </details>
  );
}
