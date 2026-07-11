"use client";

import { useState } from "react";
import Link from "next/link";
import { creerClientNavigateur } from "@/lib/supabase/client";
import ChampMotDePasse from "@/components/ChampMotDePasse";
import { DOMAINES, PROMOTIONS } from "@/lib/donnees";

// Flux d'inscription en 3 étapes (maquette v3 validée).
// signUp crée le compte Auth ; un trigger côté base crée le profil
// « en_attente » à partir des métadonnées.
export default function Inscription() {
  const [etape, setEtape] = useState(1);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [form, setForm] = useState({
    prenom: "", nom: "", email: "", motDePasse: "",
    promotion: null, domaine: "info",
  });

  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });
  const reglesMdp = [
    { ok: form.motDePasse.length >= 8, txt: "8 caractères" },
    { ok: /[A-Z]/.test(form.motDePasse), txt: "une majuscule" },
    { ok: /\d/.test(form.motDePasse), txt: "un chiffre" },
  ];
  const mdpOk = reglesMdp.every((r) => r.ok);
  const etape1Ok = form.prenom && form.nom && form.email.includes("@") && mdpOk;
  const etape2Ok = form.promotion !== null;

  const envoyer = async () => {
    setEnCours(true);
    setErreur("");
    const supabase = creerClientNavigateur();
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.motDePasse,
      options: {
        data: {
          prenom: form.prenom,
          nom: form.nom,
          promotion: form.promotion,
          domaine: form.domaine,
        },
      },
    });
    setEnCours(false);
    if (error) {
      setErreur(
        error.message.includes("already registered")
          ? "Un compte existe déjà avec cet email. Essaie de te connecter."
          : "L'inscription a échoué : " + error.message
      );
      return;
    }
    setEnvoye(true);
  };

  return (
    <main className="page">
      <header className="f-tete" style={{ paddingTop: 20 }}>
        <Link href="/" className="retour">← Retour</Link>
        <h1>Bienvenue<br />parmi <em>les tiens.</em></h1>
        <p>
          {etape === 1 && "Étape 1 sur 3 — ton identité."}
          {etape === 2 && "Étape 2 sur 3 — ta promotion. Un délégué de ta promo validera ton compte."}
          {etape === 3 && !envoye && "Étape 3 sur 3 — vérifie tes informations et envoie."}
          {envoye && "Demande envoyée !"}
        </p>
      </header>

      <div className="f-prog" aria-hidden>
        <i className={etape >= 1 ? "fait" : ""} />
        <i className={etape >= 2 ? "fait" : ""} />
        <i className={etape >= 3 ? "fait" : ""} />
      </div>

      {envoye ? (
        <div className="succes">
          <div className="coche" aria-hidden>✓</div>
          <h2>Demande envoyée</h2>
          <p>
            Confirme d&apos;abord ton adresse : un email vient de t&apos;être envoyé.<br />
            Ensuite, le délégué de la promo {form.promotion} validera ta demande —
            en général sous 24 h.
          </p>
          <Link href="/" className="btn btn-nu" style={{ marginTop: 18 }}>
            Retour à l&apos;accueil
          </Link>
        </div>
      ) : (
        <div className="f-corps">
          {etape === 1 && (
            <>
              <div className="champ">
                <label htmlFor="prenom">Prénom</label>
                <input id="prenom" className="saisie" value={form.prenom} onChange={maj("prenom")} autoComplete="given-name" />
              </div>
              <div className="champ">
                <label htmlFor="nom">Nom</label>
                <input id="nom" className="saisie" value={form.nom} onChange={maj("nom")} autoComplete="family-name" />
              </div>
              <div className="champ">
                <label htmlFor="email">Email</label>
                <input id="email" type="email" className="saisie" value={form.email} onChange={maj("email")} autoComplete="email" />
              </div>
              <ChampMotDePasse id="mdp" label="Mot de passe"
                valeur={form.motDePasse} onChange={maj("motDePasse")} autoComplete="new-password" />
              <p style={{ fontSize: 12, lineHeight: 1.6, marginTop: -8 }}>
                {reglesMdp.map((r, i) => (
                  <span key={r.txt} style={{ color: r.ok ? "#9FD8B4" : "var(--brume)" }}>
                    {r.ok ? "✓" : "·"} {r.txt}{i < reglesMdp.length - 1 ? "   " : ""}
                  </span>
                ))}
              </p>
              <button className="btn btn-or btn-bloc" disabled={!etape1Ok} onClick={() => setEtape(2)}
                style={{ opacity: etape1Ok ? 1 : 0.5 }}>
                Continuer →
              </button>
            </>
          )}

          {etape === 2 && (
            <>
              <div className="champ">
                <label>Ta promotion au LSNO</label>
                <div className="promos">
                  {PROMOTIONS.map((p) => (
                    <button
                      key={p.numero}
                      className={`pcase${form.promotion === p.numero ? " choisie" : ""}`}
                      onClick={() => setForm({ ...form, promotion: p.numero })}
                    >
                      <b>P{p.numero}</b>
                      <span>{p.enCours ? "en cours" : `Bac ${p.anneeBac}`}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="champ">
                <label htmlFor="domaine">Domaine principal</label>
                <select id="domaine" className="saisie" value={form.domaine} onChange={maj("domaine")}>
                  {DOMAINES.map((d) => (
                    <option key={d.cle} value={d.cle}>{d.nom}</option>
                  ))}
                </select>
              </div>
              <div className="f-note">
                <span>
                  <b>Un délégué de ta promotion</b> validera ta demande.
                  Ton profil n&apos;est visible d&apos;aucun visiteur extérieur.
                </span>
              </div>
              <button className="btn btn-or btn-bloc" disabled={!etape2Ok} onClick={() => setEtape(3)}
                style={{ opacity: etape2Ok ? 1 : 0.5 }}>
                Continuer →
              </button>
            </>
          )}

          {etape === 3 && (
            <>
              <div className="f-note">
                <span>
                  <b>{form.prenom} {form.nom}</b> · {form.email}<br />
                  Promotion {form.promotion} · {DOMAINES.find((d) => d.cle === form.domaine)?.nom}
                </span>
              </div>
              {erreur && (
                <p role="alert" style={{ color: "var(--rouge)", fontSize: 13, lineHeight: 1.5 }}>
                  {erreur}
                </p>
              )}
              <button className="btn btn-or btn-bloc" onClick={envoyer} disabled={enCours}
                style={{ opacity: enCours ? 0.6 : 1 }}>
                {enCours ? "Envoi…" : "Envoyer ma demande"}
              </button>
              <button className="btn btn-nu btn-bloc" onClick={() => setEtape(2)}>
                ← Corriger
              </button>
            </>
          )}
        </div>
      )}
    </main>
  );
}
