"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TabBar from "@/components/TabBar";
import Photo from "./Photo";
import Parcours from "./Parcours";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { SITUATIONS } from "@/lib/donnees";

const VISIBILITES = [
  { cle: "membres", nom: "Membres" },
  { cle: "demande", nom: "Demande" },
  { cle: "masque", nom: "Masqué" },
];

const CONTACTS = [
  { cle: "whatsapp_visi", valeur: "whatsapp", ico: "💬", nom: "WhatsApp", exemple: "WhatsApp : +226 70 00 00 00" },
  { cle: "email_visi", valeur: "email_contact", ico: "✉️", nom: "Email", exemple: "Email de contact" },
  { cle: "linkedin_visi", valeur: "linkedin", ico: "💼", nom: "LinkedIn", exemple: "LinkedIn : lien ou pseudo" },
];

export default function MonProfil() {
  const routeur = useRouter();
  const supabase = creerClientNavigateur();
  const [profil, setProfil] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return routeur.push("/connexion");
      const { data } = await supabase
        .from("profiles")
        .select("id, prenom, nom, situation, statut_titre, conseil, ville, pays, repond_cadets, statut_compte, whatsapp_visi, email_visi, linkedin_visi, photo_url, promotions(numero)")
        .eq("id", user.id)
        .maybeSingle();
      // les valeurs de contact ne sont lisibles que via cette fonction
      const { data: contacts } = await supabase.rpc("mes_contacts");
      setProfil({
        ...data,
        whatsapp: contacts?.whatsapp ?? "",
        email_contact: contacts?.email ?? "",
        linkedin: contacts?.linkedin ?? "",
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const majChamp = (champ) => (e) => setProfil({ ...profil, [champ]: e.target.value });

  const enregistrer = async () => {
    const { id, promotions, statut_compte, photo_url, ...champs } = profil;
    const { error } = await supabase.from("profiles").update(champs).eq("id", id);
    setToast(error ? "Échec de l'enregistrement : " + error.message : "Profil enregistré ✓");
    setTimeout(() => setToast(""), 3000);
  };

  const deconnecter = async () => {
    await supabase.auth.signOut();
    routeur.push("/");
    routeur.refresh();
  };

  const supprimerCompte = async () => {
    if (!confirm("Supprimer définitivement ton compte et toutes tes données ? Cette action est irréversible.")) return;
    await supabase.from("profiles").delete().eq("id", profil.id);
    await supabase.auth.signOut();
    routeur.push("/");
  };

  if (!profil) {
    return (
      <main className="page avec-tabbar">
        <p style={{ padding: 40, color: "var(--brume)", textAlign: "center" }}>Chargement…</p>
        <TabBar actif="Mon profil" />
      </main>
    );
  }

  // complétion : proportion de champs remplis
  const aRemplir = ["statut_titre", "ville", "pays", "conseil", "photo_url"];
  const completion = Math.round(
    ((aRemplir.filter((c) => profil[c]).length + 3) / (aRemplir.length + 3)) * 100
  );

  return (
    <main className="page avec-tabbar">
      <header className="f-tete" style={{ paddingTop: 20 }}>
        <Link href="/annuaire" className="retour">← Annuaire</Link>
        <h1>Modifier<br />mon <em>profil</em></h1>
        <p>
          {profil.statut_compte === "en_attente"
            ? "Ton compte est en attente de validation par un délégué — tu peux déjà compléter ton profil."
            : "Un profil complet aide les cadets à te trouver."}
        </p>
      </header>

      <div className="e-completion">
        <div className="e-cerc" style={{ background: `conic-gradient(var(--or) ${completion * 3.6}deg, rgba(147,165,192,.18) ${completion * 3.6}deg)` }}>
          <b>{completion}%</b>
        </div>
        <div className="txt">
          <b>{profil.prenom} {profil.nom} · Promo {profil.promotions?.numero}</b>
          <span>{completion === 100 ? "Profil complet, bravo !" : "Complète ton profil ci-dessous."}</span>
        </div>
      </div>

      <div className="f-corps">
        <div className="champ">
          <label>Ma photo</label>
          <Photo profil={profil}
            onPhoto={(url) => setProfil({ ...profil, photo_url: url })}
            signale={(m) => { setToast(m); setTimeout(() => setToast(""), 3000); }} />
        </div>

        <div className="champ">
          <label htmlFor="titre">En une ligne (poste, école…)</label>
          <input id="titre" className="saisie" placeholder="Ex. : Data scientist — M2 IA à Montréal"
            value={profil.statut_titre ?? ""} onChange={majChamp("statut_titre")} />
        </div>

        <div className="champ">
          <label htmlFor="situation">Situation actuelle</label>
          <select id="situation" className="saisie" value={profil.situation} onChange={majChamp("situation")}>
            {SITUATIONS.map((s) => (
              <option key={s.cle} value={s.cle}>{s.nom}</option>
            ))}
          </select>
        </div>

        <div className="champ" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label htmlFor="ville">Ville</label>
            <input id="ville" className="saisie" value={profil.ville ?? ""} onChange={majChamp("ville")} />
          </div>
          <div>
            <label htmlFor="pays">Pays (code : BF, MA…)</label>
            <input id="pays" className="saisie" maxLength={2} placeholder="BF"
              value={profil.pays ?? ""} onChange={(e) => setProfil({ ...profil, pays: e.target.value.toUpperCase() })} />
          </div>
        </div>

        <div className="champ">
          <label htmlFor="conseil">Mon conseil aux cadets</label>
          <textarea id="conseil" className="saisie" rows={3}
            value={profil.conseil ?? ""} onChange={majChamp("conseil")} />
        </div>

        <div className="champ">
          <label>Mon parcours</label>
          <Parcours profilId={profil.id}
            signale={(m) => { setToast(m); setTimeout(() => setToast(""), 3000); }} />
        </div>

        <div className="e-ligne">
          <span className="ico" aria-hidden>🤝</span>
          <span className="val">Je réponds aux cadets</span>
          <div className="seg">
            <button className={profil.repond_cadets ? "on" : ""}
              onClick={() => setProfil({ ...profil, repond_cadets: true })}>Oui</button>
            <button className={!profil.repond_cadets ? "on" : ""}
              onClick={() => setProfil({ ...profil, repond_cadets: false })}>Non</button>
          </div>
        </div>

        <div className="champ">
          <label>Mes contacts — et qui peut les voir</label>
          <div className="e-visi">
            {CONTACTS.map((c) => (
              <div key={c.cle} className="e-ligne" style={{ rowGap: 8 }}>
                <span className="ico" aria-hidden>{c.ico}</span>
                <input
                  className="saisie"
                  style={{ flex: 1, minWidth: 140, padding: "10px 12px", fontSize: 13 }}
                  placeholder={c.exemple}
                  aria-label={c.nom}
                  value={profil[c.valeur] ?? ""}
                  onChange={majChamp(c.valeur)}
                />
                <div className="seg" role="radiogroup" aria-label={`Visibilité ${c.nom}`}>
                  {VISIBILITES.map((v) => (
                    <button key={v.cle}
                      className={profil[c.cle] === v.cle ? "on" : ""}
                      onClick={() => setProfil({ ...profil, [c.cle]: v.cle })}
                      role="radio" aria-checked={profil[c.cle] === v.cle}>
                      {v.nom}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "var(--brume)", marginTop: 8, lineHeight: 1.5 }}>
            « Membres » : cliquable par les membres validés · « Demande » : ils voient que le
            contact existe, pas sa valeur · « Masqué » : invisible.
          </p>
        </div>

        <button className="btn btn-or btn-bloc" onClick={enregistrer}>Enregistrer</button>
        <Link href="/mot-de-passe/nouveau" className="btn btn-nu btn-bloc">
          Changer mon mot de passe
        </Link>
        <button className="btn btn-nu btn-bloc" onClick={deconnecter}>Se déconnecter</button>
        <button className="e-danger" onClick={supprimerCompte}>
          Supprimer mon compte et mes données
        </button>
      </div>

      <div className={`toast${toast ? " la" : ""}`} role="status">{toast}</div>
      <TabBar actif="Mon profil" />
    </main>
  );
}
