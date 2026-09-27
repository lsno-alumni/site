"use client";

import { useEffect, useState } from "react";
import { texteErreur } from "@/lib/erreurs";
import Link from "next/link";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { moderer } from "@/lib/fil";
import { adminSupprimerMessage } from "@/lib/messages";
import { modererQuestion } from "@/lib/questions";

// Signalements du Fil (migration 52) : ce que les membres ont signalé et qui
// n'a pas encore été traité. Lecture réservée aux délégués et admins par la
// politique RLS. Traiter = masquer la cible (tracé au journal) ou classer
// sans suite ; dans les deux cas la ligne sort de la liste.

const TYPES = { publication: "Publication", commentaire: "Commentaire", offre: "Offre", message: "Message privé", question: "Question aux anciens", reponse: "Réponse à une question" };

function quand(d) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function Signalements() {
  const supabase = creerClientNavigateur();
  const [lignes, setLignes] = useState(null);
  const [apercus, setApercus] = useState({});     // "commentaire:12" → { texte, masque }
  const [souci, setSouci] = useState("");

  const charger = async () => {
    const { data, error } = await supabase
      .from("signalements")
      .select("id, cible_type, cible_id, motif, cree_le, auteur:profiles!signalements_auteur_fkey(prenom, nom)")
      .is("traite_le", null).order("cree_le", { ascending: false }).limit(50);
    if (error) { setSouci(texteErreur(error)); setLignes([]); return; }
    setLignes(data ?? []);
    // un aperçu du texte visé, pour juger sans quitter la page
    const coms = (data ?? []).filter((s) => s.cible_type === "commentaire").map((s) => Number(s.cible_id));
    const pubs = (data ?? []).filter((s) => s.cible_type === "publication").map((s) => Number(s.cible_id));
    const a = {};
    if (coms.length) {
      const { data: c } = await supabase.from("commentaires").select("id, texte, masque").in("id", coms);
      (c ?? []).forEach((x) => { a[`commentaire:${x.id}`] = x; });
    }
    const qs = (data ?? []).filter((s) => s.cible_type === "question").map((s) => Number(s.cible_id));
    const rs = (data ?? []).filter((s) => s.cible_type === "reponse").map((s) => Number(s.cible_id));
    if (qs.length) {
      const { data: q } = await supabase.from("questions").select("id, titre, masquee").in("id", qs);
      (q ?? []).forEach((x) => { a[`question:${x.id}`] = { masque: x.masquee, texte: x.titre }; });
    }
    if (rs.length) {
      const { data: r } = await supabase.from("reponses").select("id, texte, masquee").in("id", rs);
      (r ?? []).forEach((x) => { a[`reponse:${x.id}`] = { masque: x.masquee, texte: x.texte }; });
    }
    if (pubs.length) {
      const { data: p } = await supabase.from("publications").select("id, texte, media_type, masquee").in("id", pubs);
      (p ?? []).forEach((x) => { a[`publication:${x.id}`] = { masque: x.masquee, texte: x.texte || (x.media_type ? "(média sans texte)" : "") }; });
    }
    setApercus(a);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { charger(); }, []);

  const traiter = async (s, masquer) => {
    setSouci("");
    try {
      if (masquer && s.cible_type === "message") await adminSupprimerMessage(s.cible_id);
      else if (masquer && (s.cible_type === "question" || s.cible_type === "reponse")) await modererQuestion(s.cible_type, s.cible_id, true);
      else if (masquer && s.cible_type !== "offre") await moderer(s.cible_type, s.cible_id, true);
      const { data: { user } } = await supabase.auth.getUser();
      // tous les signalements de la même cible sont classés d'un coup
      const { error } = await supabase.from("signalements")
        .update({ traite_le: new Date().toISOString(), traite_par: user.id })
        .eq("cible_type", s.cible_type).eq("cible_id", s.cible_id);
      if (error) throw error;
      await charger();
    } catch (e) { setSouci("Action impossible : " + texteErreur(e)); }
  };

  const lien = (s) => s.cible_type === "publication" ? `/publication/${s.cible_id}` : s.cible_type === "offre" ? `/offres/${s.cible_id}` : s.cible_type === "question" ? `/questions/${s.cible_id}` : null;

  return (
    <>
      <h2 className="a-titre" style={{ marginTop: 22 }}>Signalements</h2>
      <p style={{ fontSize: 12.5, color: "var(--brume)", marginTop: -6 }}>
        Ce que les membres ont signalé dans le Fil. Masquer retire le contenu de la vue de tous
        (l&apos;auteur le voit encore, marqué « masqué ») et s&apos;inscrit au journal.
      </p>
      {souci && <p style={{ fontSize: 12.5, color: "var(--rouge)" }}>{souci}</p>}
      {lignes === null && <p style={{ fontSize: 12.5, color: "var(--brume)" }}>…</p>}
      {lignes?.length === 0 && <p style={{ fontSize: 12.5, color: "var(--texte-2)" }}>Rien à traiter. Le fil est calme.</p>}
      {lignes?.map((s) => {
        const ap = apercus[`${s.cible_type}:${s.cible_id}`];
        const url = lien(s);
        return (
          <div key={s.id} className="carte-sombre ad-signal">
            <div className="ad-signal-tete">
              <b>{TYPES[s.cible_type]}{ap?.masque ? " · déjà masqué" : ""}</b>
              <small>{quand(s.cree_le)} · par {s.auteur?.prenom} {s.auteur?.nom}</small>
            </div>
            <p className="ad-signal-motif">{s.motif}</p>
            {ap?.texte && <blockquote className="ad-signal-apercu">{ap.texte}</blockquote>}
            <div className="ad-signal-actions">
              {url && <Link href={url} className="btn btn-nu">Voir</Link>}
              {s.cible_type !== "offre" && !ap?.masque && (
                <button type="button" className="btn btn-nu danger" onClick={() => traiter(s, true)}>{s.cible_type === "message" ? "Supprimer le message" : "Masquer"}</button>
              )}
              <button type="button" className="btn btn-nu" onClick={() => traiter(s, false)}>Classer sans suite</button>
            </div>
          </div>
        );
      })}
    </>
  );
}
