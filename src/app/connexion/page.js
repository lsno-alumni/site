"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Connexion() {
  const routeur = useRouter();
  const [form, setForm] = useState({ email: "", motDePasse: "" });

  const connecter = (e) => {
    e.preventDefault();
    // TODO Supabase : supabase.auth.signInWithPassword
    routeur.push("/annuaire");
  };

  return (
    <main className="page">
      <header className="f-tete" style={{ paddingTop: 20 }}>
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
        <div className="champ">
          <label htmlFor="mdp">Mot de passe</label>
          <input id="mdp" type="password" className="saisie" required autoComplete="current-password"
            value={form.motDePasse} onChange={(e) => setForm({ ...form, motDePasse: e.target.value })} />
        </div>
        <button type="submit" className="btn btn-or btn-bloc">Se connecter</button>
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
