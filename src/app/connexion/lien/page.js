"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { creerClientNavigateur } from "@/lib/supabase/client";
import Captcha, { captchaActif } from "@/components/Captcha";
import Sceau from "@/components/Sceau";

// Connexion SANS mot de passe : un lien envoyé par email (Supabase Auth, modèle
// « Magic link »). Réservé aux comptes existants — la réponse est la même que
// l'adresse ait un compte ou non, pour ne rien révéler. Le lien ramène sur
// /connexion/lien/retour, qui ouvre la session et la note dans le journal.
// La double authentification des délégués et admins reste exigée après.
export default function ConnexionParLien() {
  const [email, setEmail] = useState("");
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [jeton, setJeton] = useState("");
  const [essai, setEssai] = useState(0);
  const [sansVerif, setSansVerif] = useState(false);   // la vérification n'a pas abouti : on cesse de bloquer le bouton

  const envoyer = async (e) => {
    e.preventDefault();
    setEnCours(true);
    setErreur("");
    const supabase = creerClientNavigateur();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/connexion/lien/retour`, captchaToken: jeton || undefined },
    });
    setEnCours(false);
    // adresse sans compte : Supabase refuse de créer un compte — on répond comme si le lien était parti
    if (error && !/signup|not allowed|not found/i.test(error.message)) {
      setJeton(""); setEssai((n) => n + 1);
      setErreur("Envoi impossible : " + error.message);
      return;
    }
    setEnvoye(true);
  };

  return (
    <main className="page page-sceau">
      <header className="f-tete" style={{ paddingTop: 20 }}>
        <Link href="/connexion" className="retour">← Connexion</Link>
        <h1>Un lien<br /><em>pour entrer</em></h1>
        <p>Pas de mot de passe à retrouver : on t&apos;envoie un lien de connexion, valable une heure.</p>
      </header>

      {envoye ? (
        <div className="succes">
          <div className="coche" aria-hidden><MailCheck size={30} strokeWidth={2} /></div>
          <h2>Email envoyé</h2>
          <p>
            Si un compte existe pour <b>{email}</b>, un lien de connexion arrive
            dans quelques instants. Ouvre-le sur cet appareil. Pense à vérifier les spams.
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
          <Captcha onJeton={setJeton} essai={essai} onAbandon={() => setSansVerif(true)} />
          {erreur && (
            <p role="alert" style={{ color: "var(--rouge)", fontSize: 13, lineHeight: 1.5 }}>{erreur}</p>
          )}
          <button type="submit" className="btn btn-or btn-bloc" disabled={enCours || (captchaActif && !jeton && !sansVerif)}
            style={{ opacity: enCours || (captchaActif && !jeton && !sansVerif) ? 0.6 : 1 }}>
            {enCours ? "Envoi…" : "M'envoyer le lien"}
          </button>
          <p style={{ textAlign: "center", fontSize: 13, color: "var(--brume)", lineHeight: 1.5 }}>
            Tu préfères un nouveau mot de passe ?{" "}
            <Link href="/mot-de-passe/oubli" style={{ color: "var(--bleu-texte)", textDecoration: "underline" }}>Mot de passe oublié</Link>
          </p>
        </form>
      )}
      <Sceau />
    </main>
  );
}
