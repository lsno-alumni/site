"use client";

import { useState } from "react";
import Link from "next/link";
import { DOMAINES, PROMOTIONS } from "@/lib/donnees";

// Flux d'inscription en 3 étapes (maquette v3 validée).
// L'envoi réel créera le compte Supabase Auth + le profil en statut « en_attente ».
export default function Inscription() {
  const [etape, setEtape] = useState(1);
  const [envoye, setEnvoye] = useState(false);
  const [form, setForm] = useState({
    prenom: "", nom: "", email: "", motDePasse: "",
    promotion: null, domaine: "info",
  });

  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });
  const etape1Ok = form.prenom && form.nom && form.email.includes("@") && form.motDePasse.length >= 8;
  const etape2Ok = form.promotion !== null;

  const envoyer = () => {
    // TODO Supabase : supabase.auth.signUp + insertion profil en_attente
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
            Le délégué de la promo {form.promotion} a reçu ta demande.<br />
            Tu recevras un email dès validation — en général sous 24 h.
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
              <div className="champ">
                <label htmlFor="mdp">Mot de passe (8 caractères min.)</label>
                <input id="mdp" type="password" className="saisie" value={form.motDePasse} onChange={maj("motDePasse")} autoComplete="new-password" />
              </div>
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
                    <option key={d.cle} value={d.cle}>{d.icone} {d.nom}</option>
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
              <button className="btn btn-or btn-bloc" onClick={envoyer}>
                Envoyer ma demande
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
