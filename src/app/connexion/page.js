"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { creerClientNavigateur } from "@/lib/supabase/client";
import ChampMotDePasse from "@/components/ChampMotDePasse";
import Captcha, { captchaActif } from "@/components/Captcha";

// Purge les cookies de session résiduels/corrompus (vieilles sessions,
// changement de mot de passe…) — sinon ils empêchent la nouvelle session
// de s'établir. Appelée AU CLIC, jamais en tâche de fond : une purge
// asynchrone au chargement pouvait effacer la session fraîchement créée
// si elle se terminait après la connexion.
function purgeCookiesSession() {
  document.cookie.split(";").forEach((c) => {
    const nom = c.split("=")[0].trim();
    if (nom.startsWith("sb-")) {
      document.cookie = `${nom}=; path=/; max-age=0`;
    }
  });
}

export default function Connexion() {
  const routeur = useRouter();
  const [form, setForm] = useState({ email: "", motDePasse: "" });
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  // étape « code à six chiffres », uniquement si un appareil est enrôlé
  const [codeAttendu, setCodeAttendu] = useState(false);
  const [code, setCode] = useState("");
  // vérification anti-robot : un jeton ne sert qu'une fois, on en redemande un
  // après chaque échec (« essai » reconstruit le widget)
  const [jeton, setJeton] = useState("");
  const [essai, setEssai] = useState(0);
  // la vérification n'a pas abouti : on cesse de bloquer le bouton
  const [sansVerif, setSansVerif] = useState(false);

  // Un compte protégé qui revient ici (bouton « retour » depuis l'écran du
  // code, redirigé par le garde-fou du middleware, onglet rouvert…) a DÉJÀ
  // une session valide au premier niveau : pas besoin de retaper le mot de
  // passe, direct à l'écran du code.
  useEffect(() => {
    (async () => {
      const supabase = creerClientNavigateur();
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (data?.nextLevel === "aal2" && data.currentLevel !== "aal2") setCodeAttendu(true);
    })();
  }, []);

  const connecter = async (e) => {
    e.preventDefault();
    setEnCours(true);
    setErreur("");
    // repartir d'un état propre AVANT de créer la session (synchrone : aucune course)
    let supabase = creerClientNavigateur();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      purgeCookiesSession();
      supabase = creerClientNavigateur();
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email.trim().toLowerCase(),
      password: form.motDePasse,
      options: jeton ? { captchaToken: jeton } : undefined,
    });
    setEnCours(false);
    if (error) {
      setJeton(""); setEssai((n) => n + 1);   // le jeton est consommé
      setErreur(
        error.message.toLowerCase().includes("captcha")
          ? "La vérification anti-robot n'a pas abouti. Recharge la page et réessaie."
          : error.message.includes("Invalid login")
          ? "Email ou mot de passe incorrect."
          : error.message.includes("not confirmed")
            ? "Confirme d'abord ton adresse email (regarde ta boîte de réception)."
            : "Connexion impossible : " + error.message
      );
      return;
    }
    // Double authentification : si le compte a un appareil enrôlé, Supabase
    // laisse la session au premier niveau (aal1) et attend le code. On ne
    // redirige donc pas encore.
    const { data: niveau } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (niveau?.nextLevel === "aal2" && niveau.currentLevel !== "aal2") {
      setCodeAttendu(true);
      return;
    }
    // navigation complète (pas côté client) : les cookies de session partent
    // à coup sûr avec la requête — fiable même sur Samsung Internet / réseau lent
    window.location.assign("/annuaire");
  };

  const verifierCode = async (e) => {
    e.preventDefault();
    setEnCours(true);
    setErreur("");
    const supabase = creerClientNavigateur();
    const { data: liste, error: e0 } = await supabase.auth.mfa.listFactors();
    const facteur = (liste?.all ?? liste?.totp ?? [])
      .find((f) => f.factor_type === "totp" && f.status === "verified");
    if (e0 || !facteur) {
      setEnCours(false);
      setErreur("Appareil d'authentification introuvable — contacte un administrateur.");
      return;
    }
    const { data: def, error: e1 } = await supabase.auth.mfa.challenge({ factorId: facteur.id });
    if (e1) { setEnCours(false); setErreur("Vérification impossible : " + e1.message); return; }
    const { error: e2 } = await supabase.auth.mfa.verify({
      factorId: facteur.id, challengeId: def.id, code: code.trim(),
    });
    setEnCours(false);
    if (e2) {
      setErreur("Code refusé. Vérifie l'heure de ton téléphone, puis réessaie.");
      return;
    }
    window.location.assign("/annuaire");
  };

  return (
    <main className="page">
      <header className="f-tete tete-portail" style={{ paddingTop: 20 }}>
        <Link href="/" className="retour">← Retour</Link>
        <h1>Content de<br />te <em>revoir.</em></h1>
        <p>Connecte-toi pour retrouver le réseau.</p>
      </header>
      {codeAttendu ? (
        <form className="f-corps" onSubmit={verifierCode} style={{ paddingTop: 26 }}>
          <p style={{ fontSize: 13.5, color: "var(--brume)", lineHeight: 1.6 }}>
            Ton compte est protégé par la double authentification. Saisis le code à six
            chiffres affiché par ton appli d&apos;authentification.
          </p>
          <div className="champ">
            <label htmlFor="code">Code à six chiffres</label>
            <input id="code" className="saisie" inputMode="numeric" autoComplete="one-time-code"
              placeholder="123456" maxLength={6} required autoFocus
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              style={{ letterSpacing: 6, textAlign: "center" }} />
          </div>
          {erreur && (
            <p role="alert" style={{ color: "var(--rouge)", fontSize: 13, lineHeight: 1.5 }}>{erreur}</p>
          )}
          <button type="submit" className="btn btn-or btn-bloc" disabled={enCours || code.length < 6}
            style={{ opacity: enCours || code.length < 6 ? 0.6 : 1 }}>
            {enCours ? "Vérification…" : "Valider"}
          </button>
          <p style={{ textAlign: "center", fontSize: 12.5, color: "var(--brume)" }}>
            Téléphone perdu ? Un autre administrateur peut rouvrir ton accès.
          </p>
        </form>
      ) : (
      <form className="f-corps" onSubmit={connecter} style={{ paddingTop: 26 }}>
        <div className="champ">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" className="saisie" required autoComplete="email"
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <ChampMotDePasse id="mdp" label="Mot de passe" valeur={form.motDePasse}
          onChange={(e) => setForm({ ...form, motDePasse: e.target.value })} />
        <Captcha onJeton={setJeton} essai={essai} onAbandon={() => setSansVerif(true)} />
        {erreur && (
          <p role="alert" style={{ color: "var(--rouge)", fontSize: 13, lineHeight: 1.5 }}>{erreur}</p>
        )}
        <button type="submit" className="btn btn-or btn-bloc" disabled={enCours || (captchaActif && !jeton && !sansVerif)}
          style={{ opacity: enCours || (captchaActif && !jeton && !sansVerif) ? 0.6 : 1 }}>
          {enCours ? "Connexion…" : "Se connecter"}
        </button>
        <p style={{ textAlign: "center", fontSize: 13 }}>
          <Link href="/mot-de-passe/oubli" style={{ color: "var(--brume)", textDecoration: "underline", textUnderlineOffset: 3 }}>
            Mot de passe oublié ?
          </Link>
        </p>
        <p style={{ textAlign: "center", fontSize: 13, color: "var(--brume)" }}>
          Pas encore de compte ?{" "}
          <Link href="/inscription" style={{ color: "var(--or-clair)", textDecoration: "underline" }}>
            Rejoindre le réseau
          </Link>
        </p>
      </form>
      )}
    </main>
  );
}
