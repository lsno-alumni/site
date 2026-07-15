"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, ExternalLink, Megaphone, CheckCheck, Trash2 } from "lucide-react";
import Avatar from "@/components/Avatar";
import { SqueletteOffre } from "@/components/Squelettes";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { DOMAINES, LISTE_PAYS, nomPays } from "@/lib/donnees";

const TYPES = [
  { cle: "stage", nom: "Stage" },
  { cle: "emploi", nom: "Emploi" },
  { cle: "bourse", nom: "Bourse" },
  { cle: "cooptation", nom: "Cooptation" },
  { cle: "concours", nom: "Concours" },
  { cle: "autre", nom: "Autre" },
];
const nomType = (cle) => TYPES.find((t) => t.cle === cle)?.nom ?? cle;

function ilYA(date) {
  const j = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (j <= 0) return "aujourd'hui";
  if (j === 1) return "hier";
  return `il y a ${j} j`;
}

const VIERGE = { type: "stage", titre: "", description: "", domaine: "info", pays: "", ville: "", date_limite: "", lien: "" };

export default function Offres() {
  const supabase = creerClientNavigateur();
  const [moi, setMoi] = useState(null);
  const [offres, setOffres] = useState(null); // null = chargement
  const [type, setType] = useState("tous");
  const [domaine, setDomaine] = useState("");
  const [formulaire, setFormulaire] = useState(false);
  const [depliees, setDepliees] = useState({}); // id -> description dépliée
  const [form, setForm] = useState(VIERGE);
  const [enCours, setEnCours] = useState(false);
  const [toast, setToast] = useState("");

  const signale = (m) => { setToast(m); setTimeout(() => setToast(""), 3200); };

  const charger = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: p } = await supabase
        .from("profiles").select("id, role, statut_compte").eq("id", user.id).maybeSingle();
      setMoi(p);
    }
    // actives et non expirées (date limite future, ou moins de 60 jours)
    const limite60 = new Date(Date.now() - 60 * 86400000).toISOString();
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("offres")
      .select("id, type, titre, description, domaine, pays, ville, date_limite, lien, statut, cree_le, posteur:profiles!offres_posteur_fkey(id, prenom, nom, photo_url, promotions(numero))")
      .eq("statut", "active")
      .or(`date_limite.gte.${aujourdhui},and(date_limite.is.null,cree_le.gte.${limite60})`)
      .order("cree_le", { ascending: false });
    setOffres(data ?? []);
  };
  useEffect(() => { charger(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const visibles = useMemo(() => (offres ?? []).filter((o) =>
    (type === "tous" || o.type === type) && (!domaine || o.domaine === domaine)
  ), [offres, type, domaine]);

  const publier = async () => {
    if (!form.titre.trim() || !form.description.trim()) {
      signale("Le titre et la description sont obligatoires.");
      return;
    }
    setEnCours(true);
    const { error } = await supabase.from("offres").insert({
      posteur: moi.id,
      type: form.type,
      titre: form.titre.trim(),
      description: form.description.trim(),
      domaine: form.domaine,
      pays: form.pays || null,
      ville: form.ville.trim() || null,
      date_limite: form.date_limite || null,
      lien: form.lien.trim() || null,
    });
    setEnCours(false);
    if (error) {
      signale("Publication impossible : " + error.message);
      return;
    }
    setForm(VIERGE);
    setFormulaire(false);
    signale("Offre publiée ✓");
    charger();
  };

  const cloturer = async (o) => {
    await supabase.from("offres").update({ statut: "cloturee" }).eq("id", o.id);
    setOffres((l) => l.filter((x) => x.id !== o.id));
    signale("Offre clôturée ✓");
  };

  const supprimer = async (o) => {
    if (!confirm("Supprimer définitivement cette offre ?")) return;
    await supabase.from("offres").delete().eq("id", o.id);
    setOffres((l) => l.filter((x) => x.id !== o.id));
    signale("Offre supprimée");
  };

  return (
    <>
      <header className="n-tete tete-eleves">
        <h1>Offres &amp; opportunités</h1>
        <p className="cpt">Stages, bourses, cooptations — partagés entre anciens.</p>
        {moi?.statut_compte === "valide" && !formulaire && (
          <button className="btn btn-or" style={{ marginTop: 14, padding: "11px 18px", fontSize: 13.5, boxShadow: "0 4px 12px -4px rgba(232,179,60,.35)" }}
            onClick={() => setFormulaire(true)}>
            <Plus size={15} aria-hidden /> Proposer une offre
          </button>
        )}
      </header>

      {formulaire && (
        <div className="f-corps" style={{ paddingBottom: 8 }}>
          <div className="champ" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label htmlFor="o-type">Type</label>
              <select id="o-type" className="saisie" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {TYPES.map((t) => <option key={t.cle} value={t.cle}>{t.nom}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="o-domaine">Domaine</label>
              <select id="o-domaine" className="saisie" value={form.domaine} onChange={(e) => setForm({ ...form, domaine: e.target.value })}>
                {DOMAINES.map((d) => <option key={d.cle} value={d.cle}>{d.nom}</option>)}
              </select>
            </div>
          </div>
          <div className="champ">
            <label htmlFor="o-titre">Titre (90 caractères max)</label>
            <input id="o-titre" className="saisie" maxLength={90}
              placeholder="Ex. : Stage data analyst 4-6 mois — je peux pousser un CV"
              value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} />
          </div>
          <div className="champ">
            <label htmlFor="o-desc">Description</label>
            <textarea id="o-desc" className="saisie" rows={4} maxLength={600}
              placeholder="Le poste, les conditions, comment postuler…"
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="champ" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label htmlFor="o-pays">Pays</label>
              <select id="o-pays" className="saisie" value={form.pays} onChange={(e) => setForm({ ...form, pays: e.target.value })}>
                <option value="">—</option>
                {LISTE_PAYS.map(([code, nom]) => <option key={code} value={code}>{nom}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="o-ville">Ville</label>
              <input id="o-ville" className="saisie" value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} />
            </div>
          </div>
          <div className="champ" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label htmlFor="o-lim">Date limite (optionnel)</label>
              <input id="o-lim" type="date" className="saisie" value={form.date_limite}
                onChange={(e) => setForm({ ...form, date_limite: e.target.value })} />
            </div>
            <div>
              <label htmlFor="o-lien">Lien externe (optionnel)</label>
              <input id="o-lien" type="url" className="saisie" placeholder="https://…"
                value={form.lien} onChange={(e) => setForm({ ...form, lien: e.target.value })} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-or" style={{ flex: 1, padding: "11px 16px", fontSize: 13.5 }}
              onClick={publier} disabled={enCours}>
              {enCours ? "Publication…" : "Publier l'offre"}
            </button>
            <button className="btn btn-nu" style={{ padding: "11px 16px", fontSize: 13.5 }}
              onClick={() => setFormulaire(false)}>
              Annuler
            </button>
          </div>
          <p style={{ fontSize: 11.5, color: "var(--brume)", lineHeight: 1.5 }}>
            L&apos;offre est signée de ton profil. Sans date limite, elle s&apos;archive après 60 jours.
          </p>
        </div>
      )}

      <div className="n-filtres">
        <button className={`puce${type === "tous" ? " active" : ""}`} onClick={() => setType("tous")}>Toutes</button>
        {TYPES.map((t) => (
          <button key={t.cle} className={`puce${type === t.cle ? " active" : ""}`} onClick={() => setType(t.cle)}>
            {t.nom}
          </button>
        ))}
      </div>
      <div className="n-filtres" style={{ position: "static", paddingTop: 0 }}>
        <select className="puce" value={domaine} onChange={(e) => setDomaine(e.target.value)} aria-label="Filtrer par domaine">
          <option value="">Domaine — tous</option>
          {DOMAINES.map((d) => <option key={d.cle} value={d.cle}>{d.nom}</option>)}
        </select>
      </div>

      <div className="n-liste">
        {offres === null && [0, 1, 2].map((i) => <SqueletteOffre key={i} />)}

        {visibles.map((o) => {
          const mienne = moi?.id === o.posteur?.id;
          const admin = moi?.role === "admin";
          return (
            <article key={o.id} className="fiche demande" style={{ cursor: "default" }}>
              <div style={{ padding: "15px 16px 12px" }}>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 9 }}>
                  <span className="meta doree">{nomType(o.type)}</span>
                  <span className="meta">{DOMAINES.find((d) => d.cle === o.domaine)?.nom.split(" &")[0]}</span>
                  {(o.ville || o.pays) && (
                    <span className="meta">{[o.ville, o.pays ? nomPays(o.pays) : null].filter(Boolean).join(", ")}</span>
                  )}
                  {o.date_limite && (
                    <span className="meta" style={{ color: "var(--or-clair)" }}>
                      avant le {new Date(o.date_limite).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                    </span>
                  )}
                </div>
                <b style={{ fontSize: 15, lineHeight: 1.3, display: "block" }}>{o.titre}</b>
                <p className={`offre-desc${depliees[o.id] ? " ouverte" : ""}`}>
                  {o.description}
                </p>
                {o.description.length > 120 && (
                  <button
                    className="offre-lire-plus"
                    onClick={() => setDepliees((d) => ({ ...d, [o.id]: !d[o.id] }))}
                  >
                    {depliees[o.id] ? "Réduire" : "Lire plus"}
                  </button>
                )}
                {o.lien && (
                  <a href={o.lien} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12.5, color: "var(--or-clair)", textDecoration: "underline", textUnderlineOffset: 3, display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8 }}>
                    Voir l&apos;annonce <ExternalLink size={12} aria-hidden />
                  </a>
                )}
              </div>
              <div className="pied" style={{ gap: 9 }}>
                <Link href={`/profil/${o.posteur?.id}`} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <Avatar profil={{ prenom: o.posteur?.prenom ?? "?", nom: o.posteur?.nom ?? "", photo: o.posteur?.photo_url }}
                    className="offre-avatar" />
                  <span style={{ fontSize: 11.5 }}>
                    <b style={{ fontSize: 12 }}>{o.posteur?.prenom} {o.posteur?.nom}</b>
                    <span style={{ color: "var(--brume)" }}> · Promo {o.posteur?.promotions?.numero} · {ilYA(o.cree_le)}</span>
                  </span>
                </Link>
                <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  {mienne && (
                    <button className="btn btn-nu" style={{ padding: "8px 12px", fontSize: 12 }} onClick={() => cloturer(o)}>
                      <CheckCheck size={13} aria-hidden /> Pourvu
                    </button>
                  )}
                  {(mienne || admin) && (
                    <button className="btn btn-nu" style={{ padding: "8px 10px", fontSize: 12, color: "var(--rouge)" }}
                      onClick={() => supprimer(o)} aria-label="Supprimer l'offre">
                      <Trash2 size={13} aria-hidden />
                    </button>
                  )}
                  {!mienne && (
                    <Link href={`/profil/${o.posteur?.id}`} className="btn btn-or" style={{ padding: "8px 14px", fontSize: 12 }}>
                      Contacter
                    </Link>
                  )}
                </span>
              </div>
            </article>
          );
        })}

        {offres !== null && visibles.length === 0 && (
          <div className="vide">
            <div className="gros" aria-hidden><Megaphone size={30} strokeWidth={1.6} /></div>
            <b>Aucune offre pour le moment</b>
            Un stage dans ta boîte, une bourse repérée, une cooptation ?<br />
            Sois le premier à partager une opportunité.
          </div>
        )}
      </div>

      <div className={`toast${toast ? " la" : ""}`} role="status">{toast}</div>
    </>
  );
}
