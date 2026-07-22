"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { creerClientNavigateur } from "@/lib/supabase/client";
import ChampMotDePasse from "@/components/ChampMotDePasse";
import { DOMAINES, PROMOTIONS, nomDomaine } from "@/lib/donnees";

// Flux d'inscription en 3 étapes (maquette v3 validée).
// signUp crée le compte Auth ; un trigger côté base crée le profil
// « en_attente » à partir des métadonnées.
export default function Inscription() {
  const [etape, setEtape] = useState(1);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [blocage, setBlocage] = useState(false);
  const [form, setForm] = useState({
    prenom: "", nom: "", email: "", motDePasse: "",
    promotion: null, domaine: "info", domainePrecision: "",
  });

  // la progression survit à un aller-retour (conditions) ou un rechargement :
  // brouillon dans sessionStorage (onglet courant seulement, jamais le mot de passe)
  useEffect(() => {
    try {
      const brouillon = JSON.parse(sessionStorage.getItem("inscription") ?? "null");
      if (brouillon) {
        setForm((f) => ({ ...f, ...brouillon.form, motDePasse: "" }));
        // le mot de passe n'est jamais sauvegardé : retour à l'étape 1,
        // tout est prérempli, il n'y a que lui à retaper
      }
    } catch { /* brouillon illisible : on repart de zéro */ }
  }, []);
  useEffect(() => {
    if (envoye) { sessionStorage.removeItem("inscription"); return; }
    const { motDePasse, ...sans } = form;
    sessionStorage.setItem("inscription", JSON.stringify({ etape, form: sans }));
  }, [form, etape, envoye]);

  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });
  const reglesMdp = [
    { ok: form.motDePasse.length >= 8, txt: "8 caractères" },
    { ok: /[A-Z]/.test(form.motDePasse), txt: "une majuscule" },
    { ok: /\d/.test(form.motDePasse), txt: "un chiffre" },
  ];
  const mdpOk = reglesMdp.every((r) => r.ok);
  const etape1Ok = form.prenom && form.nom && form.email.includes("@") && mdpOk;
  const etape2Ok = form.promotion !== null;
  const promoChoisie = PROMOTIONS.find((p) => p.numero === form.promotion);

  const envoyer = async () => {
    setEnCours(true);
    setErreur("");
    const supabase = creerClientNavigateur();
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.motDePasse,
      options: {
        emailRedirectTo: `${window.location.origin}/bienvenue`,
        data: {
          prenom: form.prenom,
          nom: form.nom,
          promotion: form.promotion,
          domaine: form.domaine,
          domaine_precision: form.domaine === "autre" ? form.domainePrecision.trim() : "",
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
    // Supabase ne renvoie pas d'erreur si l'email existe déjà (anti-énumération) :
    // il renvoie un utilisateur sans « identities ». On le détecte pour ne pas
    // laisser croire à une nouvelle inscription.
    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setErreur("Un compte existe déjà avec cet email. Connecte-toi, ou récupère ton mot de passe si tu l'as oublié.");
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
                      type="button"
                      className={`pcase${form.promotion === p.numero ? " choisie" : ""}${p.autoriseeInscription ? "" : " verrouillee"}`}
                      aria-disabled={!p.autoriseeInscription}
                      onClick={() => {
                        if (!p.autoriseeInscription) { setBlocage(true); return; }
                        setBlocage(false);
                        // élève/bachelier de l'année : pas de domaine encore → « eleve »
                        setForm((f) => ({
                          ...f,
                          promotion: p.numero,
                          domaine: p.eleveActuel ? "eleve" : (f.domaine === "eleve" ? "info" : f.domaine),
                        }));
                      }}
                    >
                      <b>P{p.numero}</b>
                      <span>{p.autoriseeInscription ? (p.enCours ? "en cours" : `Bac ${p.anneeBac}`) : "🔒 L'an prochain"}</span>
                    </button>
                  ))}
                </div>
                {blocage && (
                  <p style={{ fontSize: 12.5, color: "var(--or-clair)", lineHeight: 1.5, marginTop: 10 }}>
                    Le réseau s&apos;ouvre à partir de la <b>première</b> 🎓 — reviens à la rentrée
                    prochaine, ta place t&apos;attend !
                  </p>
                )}
              </div>
              {/* domaine demandé seulement aux anciens ; un élève n'en a pas encore */}
              {promoChoisie?.eleveActuel ? (
                <div className="champ">
                  <label>Domaine</label>
                  <p style={{ fontSize: 12.5, color: "var(--brume)", lineHeight: 1.5 }}>
                    Tu es encore au lycée — tu préciseras ton domaine plus tard, quand tu
                    commenceras tes études supérieures. Rien à choisir ici pour l&apos;instant.
                  </p>
                </div>
              ) : (
                <div className="champ">
                  <label htmlFor="domaine">Domaine principal</label>
                  <select id="domaine" className="saisie" value={form.domaine} onChange={maj("domaine")}>
                    {DOMAINES.map((d) => (
                      <option key={d.cle} value={d.cle}>{d.nom}</option>
                    ))}
                  </select>
                  {form.domaine === "autre" && (
                    <input
                      className="saisie" style={{ marginTop: 10 }} maxLength={40}
                      placeholder="Précise ton domaine (ex. : Droit, Aviation…)"
                      aria-label="Précision du domaine"
                      value={form.domainePrecision} onChange={maj("domainePrecision")}
                    />
                  )}
                </div>
              )}
              <div className="f-note">
                <span>
                  <b>Un délégué de ta promotion</b> validera ta demande.
                  Ton profil n&apos;est visible d&apos;aucun visiteur extérieur.
                  En envoyant ta demande, tu acceptes les{" "}
                  <Link href="/conditions" target="_blank" rel="noopener" style={{
                    color: "var(--or-clair)", textDecoration: "underline", textUnderlineOffset: 3,
                    display: "inline-block", padding: "4px 2px", margin: "-2px 0",
                  }}>
                    conditions d&apos;utilisation
                  </Link>.
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
                  Promotion {form.promotion} · {nomDomaine(form.domaine, form.domainePrecision.trim())}
                </span>
              </div>
              {erreur && (
                <p role="alert" style={{ color: "var(--rouge)", fontSize: 13, lineHeight: 1.5 }}>
                  {erreur}
                  {erreur.includes("existe déjà") && (
                    <>
                      {" "}
                      <Link href="/connexion" style={{ color: "var(--or-clair)", textDecoration: "underline" }}>Se connecter</Link>
                      {" · "}
                      <Link href="/mot-de-passe/oubli" style={{ color: "var(--or-clair)", textDecoration: "underline" }}>Mot de passe oublié ?</Link>
                    </>
                  )}
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
