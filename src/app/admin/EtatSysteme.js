"use client";

import { useEffect, useState } from "react";
import { creerClientNavigateur } from "@/lib/supabase/client";

// Tableau de bord lecture seule : les tâches automatiques tournent-elles ?
const NOMS = {
  "rappel-annuel-profils": "Rappel annuel des profils (septembre)",
  "ouverture-promo-octobre": "Ouverture de la promo (1er octobre)",
  "relance-inscriptions": "Relance validations (lundi)",
  "relance-demandes-contact": "Relance mises en relation (quotidien)",
  "purge-comptes-fantomes": "Purge comptes jamais confirmés (mensuel)",
  "cloture-offres": "Clôture des offres expirées (mensuel)",
  "garde-vivant-brevo": "Contrôle des clés email (bimestriel)",
  "envoi-annonces": "Envoi des annonces (quotidien)",
};

export default function EtatSysteme() {
  const supabase = creerClientNavigateur();
  const [etat, setEtat] = useState(null);

  useEffect(() => {
    supabase.rpc("admin_etat_systeme").then(({ data }) => setEtat(data ?? false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (etat === null) return null;
  if (etat === false) return null; // migration 19 pas encore exécutée

  const date = (d) =>
    d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "jamais encore";

  return (
    <>
      <h2 className="a-titre" style={{ marginTop: 22 }}>État du système</h2>
      <p style={{ fontSize: 12.5, color: "var(--brume)", marginTop: -6 }}>
        Les tâches automatiques et leur dernière exécution.
      </p>
      <div className="carte-sombre" style={{ padding: "6px 14px" }}>
        {(etat.jobs ?? []).map((j) => {
          const ok = !j.derniere || j.derniere.statut === "succeeded";
          return (
            <div key={j.nom} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "8px 0", borderBottom: "1px solid var(--ligne)", fontSize: 12.5 }}>
              <span aria-hidden style={{ color: ok ? "#9FD8B4" : "var(--rouge)" }}>{ok ? "✓" : "✗"}</span>
              <span style={{ flex: 1, color: "var(--craie-2)" }}>{NOMS[j.nom] ?? j.nom}</span>
              <span style={{ color: ok ? "var(--brume)" : "var(--rouge)", whiteSpace: "nowrap" }}>
                {j.derniere ? `${date(j.derniere.quand)}${ok ? "" : " — échec"}` : "en attente"}
              </span>
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 14, padding: "10px 0", fontSize: 12.5, color: "var(--brume)", flexWrap: "wrap" }}>
          <span>Comptes fantômes à purger : <b style={{ color: "var(--craie)" }}>{etat.fantomes}</b></span>
          <span>Offres expirant sous 14 j : <b style={{ color: "var(--craie)" }}>{etat.offres_expirent_14j}</b></span>
        </div>
      </div>
    </>
  );
}
