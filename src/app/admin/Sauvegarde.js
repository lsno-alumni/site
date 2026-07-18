"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { creerClientNavigateur } from "@/lib/supabase/client";

// Sauvegarde mensuelle en un clic : 2 CSV (profils + parcours) téléchargés
// dans le navigateur. Les valeurs de contact privées n'y figurent pas
// (elles ne quittent la base que selon la visibilité choisie par chacun).
function versCSV(lignes) {
  if (!lignes.length) return "";
  const cles = Object.keys(lignes[0]);
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return "﻿" + [cles.join(";"), ...lignes.map((l) => cles.map((c) => cell(l[c])).join(";"))].join("\n");
}

function telecharger(nom, contenu) {
  const url = URL.createObjectURL(new Blob([contenu], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = nom; a.click();
  URL.revokeObjectURL(url);
}

export default function Sauvegarde({ signale }) {
  const supabase = creerClientNavigateur();
  const [enCours, setEnCours] = useState(false);

  const exporter = async () => {
    setEnCours(true);
    const jour = new Date().toISOString().slice(0, 10);
    const { data: profils, error } = await supabase
      .from("profiles")
      .select("id, prenom, nom, statut_compte, role, domaine, domaine_precision, situation, statut_titre, ville, pays, conseil, repond_cadets, cree_le, valide_le, promotions(numero)")
      .order("prenom");
    const { data: parcours } = await supabase
      .from("parcours")
      .select("profile_id, titre, etablissement, ville, annee_debut, annee_fin")
      .order("profile_id");
    setEnCours(false);
    if (error || !profils) { signale("Export impossible : " + (error?.message ?? "?")); return; }
    telecharger(`lsno-profils-${jour}.csv`, versCSV(profils.map((p) => ({ ...p, promotion: p.promotions?.numero, promotions: undefined }))));
    if (parcours?.length) telecharger(`lsno-parcours-${jour}.csv`, versCSV(parcours));
    signale(`Sauvegarde téléchargée ✓ (${profils.length} profils)`);
  };

  return (
    <>
      <h2 className="a-titre" style={{ marginTop: 22 }}>Sauvegarde</h2>
      <p style={{ fontSize: 12.5, color: "var(--brume)", marginTop: -6 }}>
        À faire une fois par mois : 2 fichiers CSV à ranger dans un dossier privé.
      </p>
      <button className="btn btn-nu" style={{ padding: "11px 16px", fontSize: 13 }} onClick={exporter} disabled={enCours}>
        <Download size={14} aria-hidden /> {enCours ? "Préparation…" : "Télécharger la sauvegarde"}
      </button>
    </>
  );
}
