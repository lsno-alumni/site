"use client";

import { useEffect, useState } from "react";
import { creerClientNavigateur } from "@/lib/supabase/client";

const VIERGE = { titre: "", etablissement: "", ville: "", annee_debut: "", annee_fin: "" };

export default function Parcours({ profilId, signale }) {
  const supabase = creerClientNavigateur();
  const [etapes, setEtapes] = useState([]);
  const [edition, setEdition] = useState(null); // null | { ...étape } (id absent = ajout)

  const charger = async () => {
    const { data } = await supabase
      .from("parcours")
      .select("id, titre, etablissement, ville, annee_debut, annee_fin")
      .eq("profile_id", profilId)
      .order("annee_debut", { ascending: false });
    setEtapes(data ?? []);
  };
  useEffect(() => { charger(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const enregistrer = async () => {
    if (!edition.titre || !edition.annee_debut) {
      signale("Le titre et l'année de début sont obligatoires.");
      return;
    }
    const valeurs = {
      profile_id: profilId,
      type_etape: "etape",
      titre: edition.titre,
      etablissement: edition.etablissement || null,
      ville: edition.ville || null,
      annee_debut: Number(edition.annee_debut),
      annee_fin: edition.annee_fin ? Number(edition.annee_fin) : null,
    };
    const { error } = edition.id
      ? await supabase.from("parcours").update(valeurs).eq("id", edition.id)
      : await supabase.from("parcours").insert(valeurs);
    if (error) {
      signale("Échec : " + error.message);
      return;
    }
    setEdition(null);
    charger();
    signale("Parcours mis à jour ✓");
  };

  const supprimer = async (id) => {
    await supabase.from("parcours").delete().eq("id", id);
    charger();
  };

  return (
    <div className="e-etapes">
      {etapes.map((e) => (
        <div key={e.id} className="e-etape">
          <div>
            <b>{e.titre}{e.etablissement ? ` — ${e.etablissement}` : ""}</b>
            <span>
              {e.annee_debut} → {e.annee_fin ?? "aujourd'hui"}
              {e.ville ? ` · ${e.ville}` : ""}
            </span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button className="e-crayon" aria-label={`Modifier ${e.titre}`}
              onClick={() => setEdition({ ...e, annee_debut: e.annee_debut ?? "", annee_fin: e.annee_fin ?? "" })}>✎</button>
            <button className="e-crayon" style={{ color: "var(--rouge)" }} aria-label={`Supprimer ${e.titre}`}
              onClick={() => supprimer(e.id)}>✕</button>
          </div>
        </div>
      ))}

      {edition ? (
        <div className="carte-sombre" style={{ padding: 15, display: "grid", gap: 10 }}>
          <input className="saisie" placeholder="Titre (ex. : Licence Maths-Info) *"
            value={edition.titre} onChange={(e) => setEdition({ ...edition, titre: e.target.value })} />
          <input className="saisie" placeholder="Établissement"
            value={edition.etablissement ?? ""} onChange={(e) => setEdition({ ...edition, etablissement: e.target.value })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <input className="saisie" placeholder="Début *" inputMode="numeric" maxLength={4}
              value={edition.annee_debut} onChange={(e) => setEdition({ ...edition, annee_debut: e.target.value })} />
            <input className="saisie" placeholder="Fin (vide = en cours)" inputMode="numeric" maxLength={4}
              value={edition.annee_fin} onChange={(e) => setEdition({ ...edition, annee_fin: e.target.value })} />
            <input className="saisie" placeholder="Ville"
              value={edition.ville ?? ""} onChange={(e) => setEdition({ ...edition, ville: e.target.value })} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-or" style={{ flex: 1, padding: 12 }} onClick={enregistrer}>
              {edition.id ? "Enregistrer" : "Ajouter"}
            </button>
            <button className="btn btn-nu" style={{ padding: "12px 16px" }} onClick={() => setEdition(null)}>
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button className="e-ajout" onClick={() => setEdition({ ...VIERGE })}>+ Ajouter une étape</button>
      )}
    </div>
  );
}
