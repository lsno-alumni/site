"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { creerClientNavigateur } from "@/lib/supabase/client";
import ChampMotDePasse from "@/components/ChampMotDePasse";

// Page d'atterrissage du lien de récupération (et du changement volontaire :
// accessible aussi connecté). Le client Supabase échange automatiquement le
// code présent dans l'URL contre une session, puis on met à jour le mot de passe.
export default function NouveauMotDePasse() {
  const routeur = useRouter();
  const supabase = creerClientNavigateur();
  const [pret, setPret] = useState(false);      // session détectée ?
  const [mdp, setMdp] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState("");
  const [fini, setFini] = useState(false);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    // laisse le temps au client d'échanger le ?code= de l'URL
    const t = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setPret(true);
        clearInterval(t);
      }
    }, 400);
    const fin = setTimeout(() => clearInterval(t), 8000);
    return () => { clearInterval(t); clearTimeout(fin); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const valider = async (e) => {
    e.preventDefault();
    if (mdp.length < 8 || !/[A-Z]/.test(mdp) || !/\d/.test(mdp)) {
      setErreur("Le mot de passe doit faire au moins 8 caractères et contenir une majuscule et un chiffre.");
      return;
    }
    if (mdp !== confirmation) { setErreur("Les deux saisies ne correspondent pas."); return; }
    setEnCours(true);
    setErreur("");
    const { error } = await supabase.auth.updateUser({ password: mdp });
    setEnCours(false);
    if (error) {
      setErreur("Changement impossible : " + error.message);
      return;
    }
    setFini(true);
    setTimeout(() => { routeur.push("/annuaire"); routeur.refresh(); }, 1800);
  };

  return (
    <main className="page">
      <header className="f-tete" style={{ paddingTop: 20 }}>
        <Link href="/connexion" className="retour">← Connexion</Link>
        <h1>Nouveau<br /><em>mot de passe</em></h1>
        <p>Au moins 8 caractères, avec une majuscule et un chiffre.</p>
      </header>

      {fini ? (
        <div className="succes">
          <div className="coche" aria-hidden>✓</div>
          <h2>Mot de passe changé</h2>
          <p>Tu es connecté·e — redirection vers l&apos;annuaire…</p>
        </div>
      ) : !pret ? (
        <div className="succes">
          <p style={{ paddingTop: 20 }}>Vérification du lien…</p>
          <p style={{ marginTop: 14, fontSize: 12.5 }}>
            Si rien ne se passe après quelques secondes, le lien a peut-être expiré :{" "}
            <Link href="/mot-de-passe/oubli" style={{ color: "var(--or-clair)", textDecoration: "underline" }}>
              demande un nouveau lien
            </Link>.
          </p>
        </div>
      ) : (
        <form className="f-corps" onSubmit={valider} style={{ paddingTop: 26 }}>
          <ChampMotDePasse id="mdp" label="Nouveau mot de passe" valeur={mdp}
            onChange={(e) => setMdp(e.target.value)} autoComplete="new-password" />
          <ChampMotDePasse id="conf" label="Confirme-le" valeur={confirmation}
            onChange={(e) => setConfirmation(e.target.value)} autoComplete="new-password" />
          {erreur && (
            <p role="alert" style={{ color: "var(--rouge)", fontSize: 13, lineHeight: 1.5 }}>{erreur}</p>
          )}
          <button type="submit" className="btn btn-or btn-bloc" disabled={enCours}
            style={{ opacity: enCours ? 0.6 : 1 }}>
            {enCours ? "Enregistrement…" : "Changer le mot de passe"}
          </button>
        </form>
      )}
    </main>
  );
}
