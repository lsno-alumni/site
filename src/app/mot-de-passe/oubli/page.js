"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { creerClientNavigateur } from "@/lib/supabase/client";

export default function MotDePasseOublie() {
  const [email, setEmail] = useState("");
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  const envoyer = async (e) => {
    e.preventDefault();
    setEnCours(true);
    setErreur("");
    const supabase = creerClientNavigateur();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/mot-de-passe/nouveau`,
    });
    setEnCours(false);
    if (error) {
      setErreur("Envoi impossible : " + error.message);
      return;
    }
    setEnvoye(true);
  };

  return (
    <main className="page">
      <header className="f-tete" style={{ paddingTop: 20 }}>
        <Link href="/connexion" className="retour">← Connexion</Link>
        <h1>Mot de passe<br /><em>oublié ?</em></h1>
        <p>Pas de panique — on t&apos;envoie un lien pour en choisir un nouveau.</p>
      </header>

      {envoye ? (
        <div className="succes">
          <div className="coche" aria-hidden><MailCheck size={30} strokeWidth={2} /></div>
          <h2>Email envoyé</h2>
          <p>
            Si un compte existe pour <b>{email}</b>, tu recevras un lien
            dans quelques instants. Pense à vérifier les spams.
          </p>
          <Link href="/connexion" className="btn btn-nu" style={{ marginTop: 18 }}>
            Retour à la connexion
          </Link>
        </div>
      ) : (
        <form className="f-corps" onSubmit={envoyer} style={{ paddingTop: 26 }}>
          <div className="champ">
            <label htmlFor="email">Ton email d&apos;inscription</label>
            <input id="email" type="email" className="saisie" required autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {erreur && (
            <p role="alert" style={{ color: "var(--rouge)", fontSize: 13, lineHeight: 1.5 }}>{erreur}</p>
          )}
          <button type="submit" className="btn btn-or btn-bloc" disabled={enCours}
            style={{ opacity: enCours ? 0.6 : 1 }}>
            {enCours ? "Envoi…" : "M'envoyer le lien"}
          </button>
        </form>
      )}
    </main>
  );
}
