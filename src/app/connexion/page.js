"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { creerClientNavigateur } from "@/lib/supabase/client";
import ChampMotDePasse from "@/components/ChampMotDePasse";

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
      email: form.email,
      password: form.motDePasse,
    });
    setEnCours(false);
    if (error) {
      setErreur(
        error.message.includes("Invalid login")
          ? "Email ou mot de passe incorrect."
          : error.message.includes("not confirmed")
            ? "Confirme d'abord ton adresse email (regarde ta boîte de réception)."
            : "Connexion impossible : " + error.message
      );
      return;
    }
    routeur.push("/annuaire");
    routeur.refresh();
  };

  return (
    <main className="page">
      <header className="f-tete tete-portail" style={{ paddingTop: 20 }}>
        <Link href="/" className="retour">← Retour</Link>
        <h1>Content de<br />te <em>revoir.</em></h1>
        <p>Connecte-toi pour retrouver le réseau.</p>
      </header>
      <form className="f-corps" onSubmit={connecter} style={{ paddingTop: 26 }}>
        <div className="champ">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" className="saisie" required autoComplete="email"
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <ChampMotDePasse id="mdp" label="Mot de passe" valeur={form.motDePasse}
          onChange={(e) => setForm({ ...form, motDePasse: e.target.value })} />
        {erreur && (
          <p role="alert" style={{ color: "var(--rouge)", fontSize: 13, lineHeight: 1.5 }}>{erreur}</p>
        )}
        <button type="submit" className="btn btn-or btn-bloc" disabled={enCours}
          style={{ opacity: enCours ? 0.6 : 1 }}>
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
    </main>
  );
}
