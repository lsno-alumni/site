"use client";

import { useEffect, useRef, useState } from "react";
import TabBar from "@/components/TabBar";
import Avatar from "@/components/Avatar";
import { demandesEnAttente } from "@/lib/donnees";

// Espace délégué / admin : file de validation des inscriptions,
// avec annulation (undo) — maquette v3 validée.
export default function Validation() {
  const [demandes, setDemandes] = useState([]);
  const [traitees, setTraitees] = useState({});   // id -> "valide" | "refuse"
  const [membres, setMembres] = useState(52);
  const [snack, setSnack] = useState(null);       // { id, valide }
  const minuteur = useRef(null);

  useEffect(() => {
    demandesEnAttente().then(setDemandes);
  }, []);

  const traiter = (d, valide) => {
    // TODO Supabase : update profiles set statut_compte = valide ? 'valide' : refus
    setTraitees((t) => ({ ...t, [d.id]: valide ? "valide" : "refuse" }));
    if (valide) setMembres((m) => m + 1);
    setSnack({ id: d.id, valide });
    clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => setSnack(null), 4200);
  };

  const annuler = () => {
    const { id, valide } = snack;
    setTraitees((t) => {
      const copie = { ...t };
      delete copie[id];
      return copie;
    });
    if (valide) setMembres((m) => m - 1);
    setSnack(null);
  };

  const enAttente = demandes.filter((d) => !traitees[d.id]);

  return (
    <main className="page avec-tabbar">
      <header className="n-tete" style={{ paddingBottom: 18 }}>
        <p className="tagline">Espace délégué · Promo 3</p>
        <h1 style={{ marginTop: 8 }}>Demandes<br />d&apos;inscription</h1>
        <p className="cpt">
          {enAttente.length > 0 ? `${enAttente.length} en attente` : "Tout est à jour ✓"}
        </p>
      </header>

      <div className="n-liste">
        {enAttente.map((d) => (
          <div key={d.id} className="fiche demande">
            <div className="haut">
              <Avatar profil={d} className="init" />
              <div>
                <b>{d.prenom} {d.nom}</b>
                <div className="role">Se déclare Promo {d.promotion} · Bac {d.anneeBac}</div>
              </div>
            </div>
            <div className="pied" style={{ gap: 10 }}>
              <button className="btn btn-or" style={{ flex: 1, padding: 11 }} onClick={() => traiter(d, true)}>
                Valider
              </button>
              <button className="btn btn-nu" style={{ padding: "11px 18px" }} onClick={() => traiter(d, false)}>
                Refuser
              </button>
            </div>
          </div>
        ))}

        <h2 className="a-titre" style={{ marginTop: 18 }}>Ma promotion</h2>
        <div className="e-stat">
          <b>{membres}</b><span>membres validés</span>
          <b>81%</b><span>profils complets</span>
        </div>
      </div>

      <div className={`toast${snack ? " la" : ""}`} role="status">
        {snack && (snack.valide ? "Membre validé ✓" : "Demande refusée")}
        {snack && (
          <button onClick={annuler} style={{
            border: "none", background: "none", fontWeight: 800, color: "#8A6A1D",
            marginLeft: 12, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3,
          }}>
            Annuler
          </button>
        )}
      </div>
      <TabBar actif="Validation" />
    </main>
  );
}
