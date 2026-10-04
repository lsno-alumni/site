"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Check, X, Loader2 } from "lucide-react";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { texteErreur } from "@/lib/erreurs";
import { listeBibliotheque, modererDocument, libelleType, libelleClasse, tailleLisible } from "@/lib/bibliotheque";

// Modération de la bibliothèque : les propositions en attente, à publier ou
// refuser (avec un motif envoyé à l'auteur). Délégués et admins.
const quand = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function Bibliotheque({ signale }) {
  const [lignes, setLignes] = useState(null);
  const [souci, setSouci] = useState("");
  const [motifs, setMotifs] = useState({});
  const [enCours, setEnCours] = useState(null);
  const charger = async () => {
    try { setLignes(await listeBibliotheque(creerClientNavigateur(), "en_attente")); setSouci(""); }
    catch (e) { setSouci(texteErreur(e)); setLignes([]); }
  };
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { charger(); }, []);

  const decider = async (f, decision) => {
    const motif = (motifs[f.id] ?? "").trim();
    if (decision === "refuse" && motif.length < 3) { setSouci("Donne un motif court à l'auteur avant de refuser."); return; }
    setEnCours(f.id); setSouci("");
    try {
      await modererDocument(creerClientNavigateur(), f.id, decision, decision === "refuse" ? motif : null);
      signale?.(decision === "publie" ? `« ${f.titre} » est publié dans la bibliothèque.` : `« ${f.titre} » refusé — l'auteur est prévenu.`);
      await charger();
    } catch (e) { setSouci(texteErreur(e)); }
    setEnCours(null);
  };

  if (lignes === null) return <p style={{ color: "var(--brume)", fontSize: 14 }}>Chargement…</p>;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p style={{ fontSize: 13.5, color: "var(--texte-2)", margin: 0, lineHeight: 1.55 }}>
        Les documents proposés par les membres. Ouvre le fichier, vérifie qu&apos;il s&apos;agit bien d&apos;un sujet, d&apos;un cours ou d&apos;un corrigé partageable, puis publie — ou refuse avec un mot pour l&apos;auteur.
      </p>
      {souci && <p className="pu-vide">{souci}</p>}
      {lignes.length === 0 && !souci && <p className="pu-vide">Rien à relire pour l&apos;instant.</p>}
      {lignes.map((f) => (
        <div key={f.id} className="ad-signal bib-moderation">
          <div className="bib-meta"><b>{libelleType(f.type)}</b> · {f.matiere} · {libelleClasse(f.classe)}{f.serie ? ` ${f.serie}` : ""} · {f.annee}</div>
          <a href={f.lien} target="_blank" rel="noopener noreferrer" className="bib-titre" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{f.titre} <ExternalLink size={13} aria-hidden /></a>
          {f.description && <p className="bib-desc" style={{ margin: "4px 0 0" }}>{f.description}</p>}
          <p className="bib-pied">{f.auteur ? `${f.auteur.prenom} ${f.auteur.nom}${f.auteur.promo ? ` · promo ${f.auteur.promo}` : ""}` : "membre parti"} · {quand(f.propose_le)}{f.taille ? ` · ${tailleLisible(f.taille)}` : ""}{f.drive_id ? " · sur le Drive de l'association" : " · lien externe"}</p>
          <input type="text" className="saisie" placeholder="Motif en cas de refus (envoyé à l'auteur)" maxLength={300} value={motifs[f.id] ?? ""} onChange={(e) => setMotifs((m) => ({ ...m, [f.id]: e.target.value }))} aria-label={`Motif de refus pour ${f.titre}`} style={{ fontSize: 13.5 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-or" disabled={enCours === f.id} onClick={() => decider(f, "publie")} style={{ flex: 1, padding: "10px 12px" }}>{enCours === f.id ? <Loader2 size={15} className="tourne" aria-hidden /> : <Check size={15} aria-hidden />} Publier</button>
            <button type="button" className="btn btn-nu" disabled={enCours === f.id} onClick={() => decider(f, "refuse")} style={{ flex: 1, padding: "10px 12px" }}><X size={15} aria-hidden /> Refuser</button>
          </div>
        </div>
      ))}
    </div>
  );
}
