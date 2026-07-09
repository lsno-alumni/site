"use client";

import { useState } from "react";
import Link from "next/link";
import TabBar from "@/components/TabBar";
import { SITUATIONS } from "@/lib/donnees";

const VISIBILITES = [
  { cle: "membres", nom: "Membres" },
  { cle: "demande", nom: "Demande" },
  { cle: "masque", nom: "Masqué" },
];

const CONTACTS = [
  { cle: "whatsapp", ico: "💬", nom: "WhatsApp" },
  { cle: "email", ico: "✉️", nom: "Email" },
  { cle: "linkedin", ico: "💼", nom: "LinkedIn" },
];

// Écran d'édition (maquette v3). Les valeurs viendront du profil Supabase.
export default function MonProfil() {
  const [situation, setSituation] = useState("etudiant");
  const [visi, setVisi] = useState({ whatsapp: "membres", email: "demande", linkedin: "membres" });
  const [etapes] = useState([
    { titre: "Master 2 IA — Montréal", periode: "2025 → aujourd'hui" },
    { titre: "Licence Maths-Info — UJKZ", periode: "2023 → 2025" },
  ]);
  const [toast, setToast] = useState(false);

  const enregistrer = () => {
    // TODO Supabase : update profiles + parcours
    setToast(true);
    setTimeout(() => setToast(false), 2600);
  };

  const completion = 80; // TODO : calculé depuis les champs remplis du profil

  return (
    <main className="page avec-tabbar">
      <header className="f-tete" style={{ paddingTop: 20 }}>
        <Link href="/annuaire" className="retour">← Mon compte</Link>
        <h1>Modifier<br />mon <em>profil</em></h1>
        <p>Un profil complet aide les cadets à te trouver.</p>
      </header>

      <div className="e-completion">
        <div className="e-cerc" style={{ background: `conic-gradient(var(--or) ${completion * 3.6}deg, rgba(147,165,192,.18) ${completion * 3.6}deg)` }}>
          <b>{completion}%</b>
        </div>
        <div className="txt"><b>Presque complet</b><span>Ajoute une photo pour finir.</span></div>
      </div>

      <div className="f-corps">
        <div className="champ">
          <label htmlFor="situation">Situation actuelle</label>
          <select id="situation" className="saisie" value={situation} onChange={(e) => setSituation(e.target.value)}>
            {SITUATIONS.map((s) => (
              <option key={s.cle} value={s.cle}>{s.nom}</option>
            ))}
          </select>
        </div>

        <div className="champ">
          <label>Mon parcours</label>
          <div className="e-etapes">
            {etapes.map((e, i) => (
              <div key={i} className="e-etape">
                <div><b>{e.titre}</b><span>{e.periode}</span></div>
                <button className="e-crayon" aria-label={`Modifier ${e.titre}`}>✎</button>
              </div>
            ))}
            <button className="e-ajout">+ Ajouter une étape</button>
          </div>
        </div>

        <div className="champ">
          <label>Qui peut voir mes contacts ?</label>
          <div className="e-visi">
            {CONTACTS.map((c) => (
              <div key={c.cle} className="e-ligne">
                <span className="ico" aria-hidden>{c.ico}</span>
                <span className="val">{c.nom}</span>
                <div className="seg" role="radiogroup" aria-label={`Visibilité ${c.nom}`}>
                  {VISIBILITES.map((v) => (
                    <button
                      key={v.cle}
                      className={visi[c.cle] === v.cle ? "on" : ""}
                      onClick={() => setVisi({ ...visi, [c.cle]: v.cle })}
                      role="radio"
                      aria-checked={visi[c.cle] === v.cle}
                    >
                      {v.nom}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <button className="btn btn-or btn-bloc" onClick={enregistrer}>Enregistrer</button>
        <button className="e-danger">Supprimer mon compte et mes données</button>
      </div>

      <div className={`toast${toast ? " la" : ""}`} role="status">Profil enregistré ✓</div>
      <TabBar actif="Mon profil" />
    </main>
  );
}
