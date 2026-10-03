"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Hourglass, LogIn } from "lucide-react";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { noterNavigationComplete } from "@/components/SuiviNavigation";
import Sceau from "@/components/Sceau";

// Atterrissage du lien de connexion. Le client Supabase échange le code du
// lien contre une session (quelques centaines de millisecondes) ; on note la
// connexion dans le journal, puis on entre par une navigation complète pour
// que le serveur voie la session — et exige le code de double authentification
// si le compte en a une. Sans session au bout de six secondes : le lien a
// expiré, a déjà servi, ou a été ouvert dans un autre navigateur (le flux PKCE
// ne peut alors pas créer de session) — on propose d'en demander un autre.
export default function RetourLien() {
  const [etat, setEtat] = useState("attente");   // attente | entre | echec

  useEffect(() => {
    const supabase = creerClientNavigateur();
    let fini = false;
    const t = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || fini) return;
      fini = true; clearInterval(t);
      setEtat("entre");
      await supabase.rpc("noter_connexion_lien").then(() => {}, () => {});   // la note n'empêche jamais d'entrer
      noterNavigationComplete();
      window.location.assign("/");
    }, 400);
    const fin = setTimeout(() => { if (!fini) { fini = true; clearInterval(t); setEtat("echec"); } }, 6000);
    return () => { clearInterval(t); clearTimeout(fin); };
  }, []);

  return (
    <main className="page page-sceau">
      <header className="f-tete" style={{ paddingTop: 20 }}>
        <h1 style={{ marginTop: 30 }}>Connexion<br /><em>par lien</em></h1>
      </header>
      <div className="succes" style={{ paddingTop: 30 }}>
        {etat === "echec" ? (
          <>
            <div className="coche" aria-hidden><Hourglass size={30} strokeWidth={2} /></div>
            <h2>Ce lien ne fonctionne plus</h2>
            <p>Il a expiré, a déjà servi, ou a été ouvert sur un autre appareil que celui où tu l&apos;as demandé. Demandes-en un nouveau : ça prend dix secondes.</p>
            <Link href="/connexion/lien" className="btn btn-or" style={{ marginTop: 20 }}>Recevoir un nouveau lien</Link>
            <Link href="/connexion" className="btn btn-nu" style={{ marginTop: 10 }}>Me connecter avec mon mot de passe</Link>
          </>
        ) : (
          <>
            <div className="coche" aria-hidden><LogIn size={30} strokeWidth={2} /></div>
            <h2>{etat === "entre" ? "C'est bon, tu entres…" : "Un instant…"}</h2>
            <p>{etat === "entre" ? "Ta session est ouverte." : "On ouvre ta session."}</p>
          </>
        )}
      </div>
      <Sceau />
    </main>
  );
}
