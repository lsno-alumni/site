"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Plus, ExternalLink, Megaphone, CheckCheck, Trash2, Hourglass, Pencil, Share2, Paperclip, FileText, Image as ImageIcon } from "lucide-react";
import Avatar from "@/components/Avatar";
import { RestaurerDefilement } from "@/components/SuiviNavigation";
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
const MAX_FICHIERS = 5;
const MAX_TAILLE = 10 * 1024 * 1024; // 10 Mo
const fichierOk = (f) => f.type === "application/pdf" || f.type.startsWith("image/");

// sans protocole, un lien serait pris pour un chemin DU site (→ 404)
function lienAbsolu(v) {
  const l = (v ?? "").trim();
  if (!l) return null;
  return /^https?:\/\//i.test(l) ? l : `https://${l}`;
}

export default function Offres() {
  const supabase = creerClientNavigateur();
  const [moi, setMoi] = useState(null);
  const [offres, setOffres] = useState(null); // null = chargement
  const [type, setType] = useState("tous");
  const [domaine, setDomaine] = useState("");
  const [triLimite, setTriLimite] = useState(false); // date limite la plus proche d'abord
  const [formulaire, setFormulaire] = useState(false);
  const [edition, setEdition] = useState(null); // id de l'offre en cours de modification
  const [depliees, setDepliees] = useState({}); // id -> description dépliée
  const [form, setForm] = useState(VIERGE);
  const [fichiers, setFichiers] = useState([]);              // nouveaux File à téléverser
  const [fichiersExistants, setFichiersExistants] = useState([]); // {id, chemin, nom, type} (édition)
  const [fichiersASupprimer, setFichiersASupprimer] = useState([]); // {id, chemin} retirés en édition
  const champFichier = useRef(null);
  const [enCours, setEnCours] = useState(false);
  const [toast, setToast] = useState("");

  const signale = (m) => { setToast(m); setTimeout(() => setToast(""), 3200); };
  const urlPublique = (chemin) => supabase.storage.from("ressources").getPublicUrl(chemin).data.publicUrl;

  const ajouterFichiers = (e) => {
    const choisis = Array.from(e.target.files || []);
    e.target.value = "";
    const valides = [];
    for (const f of choisis) {
      if (!fichierOk(f)) { signale(`${f.name} : format refusé (PDF ou image).`); continue; }
      if (f.size > MAX_TAILLE) { signale(`${f.name} : trop lourd (10 Mo max).`); continue; }
      valides.push(f);
    }
    const max = MAX_FICHIERS - fichiersExistants.length;
    setFichiers((l) => {
      const combi = [...l, ...valides];
      if (combi.length > max) signale(`Maximum ${MAX_FICHIERS} fichiers au total.`);
      return combi.slice(0, max);
    });
  };
  const retirerNouveau = (i) => setFichiers((l) => l.filter((_, k) => k !== i));
  const retirerExistant = (f) => {
    setFichiersExistants((l) => l.filter((x) => x.id !== f.id));
    setFichiersASupprimer((l) => [...l, f]);
  };
  const reinitialiser = () => {
    setForm(VIERGE); setFormulaire(false); setEdition(null);
    setFichiers([]); setFichiersExistants([]); setFichiersASupprimer([]);
  };

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
      .select("id, type, titre, description, domaine, pays, ville, date_limite, lien, statut, cree_le, posteur:profiles!offres_posteur_fkey(id, prenom, nom, photo_url, promotions(numero)), fichiers:offre_fichiers(id, chemin, nom, type)")
      .eq("statut", "active")
      .or(`date_limite.gte.${aujourdhui},and(date_limite.is.null,cree_le.gte.${limite60})`)
      .order("cree_le", { ascending: false });
    setOffres(data ?? []);
  };
  useEffect(() => { charger(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // lien de partage /offres/ID → arrivée sur #o-ID : défile et surligne l'offre
  useEffect(() => {
    if (offres === null) return;
    const h = window.location.hash;
    if (!h.startsWith("#o-")) return;
    const el = document.getElementById(h.slice(1));
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("offre-focus");
      setTimeout(() => el.classList.remove("offre-focus"), 2600);
    }
  }, [offres]);

  const partager = async (o) => {
    const url = `${window.location.origin}/offres/${o.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: o.titre, url });
      } else {
        await navigator.clipboard.writeText(url);
        signale("Lien de l'offre copié ✓");
      }
    } catch { /* partage annulé */ }
  };

  const visibles = useMemo(() => {
    const liste = (offres ?? []).filter((o) =>
      (type === "tous" || o.type === type) && (!domaine || o.domaine === domaine)
    );
    if (triLimite) {
      // échéance la plus proche d'abord ; les offres sans date limite à la fin
      return [...liste].sort((a, b) =>
        (a.date_limite ? new Date(a.date_limite).getTime() : Infinity) -
        (b.date_limite ? new Date(b.date_limite).getTime() : Infinity)
      );
    }
    return liste; // plus récentes d'abord (ordre de la requête)
  }, [offres, type, domaine, triLimite]);

  const publier = async () => {
    if (!form.titre.trim() || !form.description.trim()) {
      signale("Le titre et la description sont obligatoires.");
      return;
    }
    setEnCours(true);
    const valeurs = {
      type: form.type,
      titre: form.titre.trim(),
      description: form.description.trim(),
      domaine: form.domaine,
      pays: form.pays || null,
      ville: form.ville.trim() || null,
      date_limite: form.date_limite || null,
      lien: lienAbsolu(form.lien),
    };
    // même formulaire pour publier et corriger (la RLS limite au posteur)
    let offreId = edition;
    let error;
    if (edition) {
      ({ error } = await supabase.from("offres").update(valeurs).eq("id", edition));
    } else {
      const res = await supabase.from("offres").insert({ posteur: moi.id, ...valeurs }).select("id").single();
      error = res.error; offreId = res.data?.id;
    }
    if (error || !offreId) {
      setEnCours(false);
      signale((edition ? "Modification" : "Publication") + " impossible : " + (error?.message ?? ""));
      return;
    }

    // pièces jointes : retirer les fichiers supprimés (édition), puis téléverser les nouveaux
    if (fichiersASupprimer.length) {
      await supabase.storage.from("ressources").remove(fichiersASupprimer.map((f) => f.chemin));
      await supabase.from("offre_fichiers").delete().in("id", fichiersASupprimer.map((f) => f.id));
    }
    for (let i = 0; i < fichiers.length; i++) {
      const f = fichiers[i];
      const nomSafe = f.name.replace(/[^\w.\-]+/g, "_").slice(-80);
      const chemin = `${moi.id}/${offreId}/${Date.now()}-${i}-${nomSafe}`;
      const up = await supabase.storage.from("ressources").upload(chemin, f, { contentType: f.type });
      if (up.error) { signale(`Échec de l'envoi de ${f.name}`); continue; }
      await supabase.from("offre_fichiers").insert({ offre_id: offreId, chemin, nom: f.name, type: f.type, taille: f.size });
    }

    setEnCours(false);
    reinitialiser();
    signale(edition ? "Offre modifiée ✓" : "Offre publiée ✓");
    charger();
  };

  const modifier = (o) => {
    setForm({
      type: o.type, titre: o.titre, description: o.description, domaine: o.domaine,
      pays: o.pays ?? "", ville: o.ville ?? "", date_limite: o.date_limite ?? "", lien: o.lien ?? "",
    });
    setFichiers([]);
    setFichiersExistants(o.fichiers ?? []);
    setFichiersASupprimer([]);
    setEdition(o.id);
    setFormulaire(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cloturer = async (o) => {
    await supabase.from("offres").update({ statut: "cloturee" }).eq("id", o.id);
    setOffres((l) => l.filter((x) => x.id !== o.id));
    signale("Offre clôturée ✓");
  };

  const supprimer = async (o) => {
    if (!confirm("Supprimer définitivement cette offre ?")) return;
    // retire d'abord les pièces jointes du stockage (les lignes partent en cascade)
    if (o.fichiers?.length) {
      await supabase.storage.from("ressources").remove(o.fichiers.map((f) => f.chemin));
    }
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
          <div className="champ">
            <label>Fichiers joints (optionnel) — PDF ou images, 10 Mo max, 5 max</label>
            {(fichiersExistants.length > 0 || fichiers.length > 0) && (
              <div className="o-joint-liste">
                {fichiersExistants.map((f) => (
                  <span key={`e-${f.id}`} className="o-joint">
                    <span className="o-joint-nom">{f.nom}</span>
                    <button type="button" onClick={() => retirerExistant(f)} aria-label={`Retirer ${f.nom}`}>×</button>
                  </span>
                ))}
                {fichiers.map((f, i) => (
                  <span key={`n-${i}`} className="o-joint">
                    <span className="o-joint-nom">{f.name}</span>
                    <button type="button" onClick={() => retirerNouveau(i)} aria-label={`Retirer ${f.name}`}>×</button>
                  </span>
                ))}
              </div>
            )}
            {fichiersExistants.length + fichiers.length < MAX_FICHIERS && (
              <button type="button" className="btn btn-nu" style={{ padding: "10px 14px", fontSize: 13 }}
                onClick={() => champFichier.current?.click()}>
                <Paperclip size={13} aria-hidden /> Joindre des fichiers
              </button>
            )}
            <input ref={champFichier} type="file" accept="application/pdf,image/*" multiple hidden onChange={ajouterFichiers} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-or" style={{ flex: 1, padding: "11px 16px", fontSize: 13.5 }}
              onClick={publier} disabled={enCours}>
              {enCours ? "Enregistrement…" : edition ? "Enregistrer les modifications" : "Publier l'offre"}
            </button>
            <button className="btn btn-nu" style={{ padding: "11px 16px", fontSize: 13.5 }}
              onClick={reinitialiser}>
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
        <button className={`puce${triLimite ? " active" : ""}`} onClick={() => setTriLimite(!triLimite)}
          aria-pressed={triLimite}>
          <Hourglass size={12} strokeWidth={2} aria-hidden style={{ verticalAlign: "-1.5px", marginRight: 4 }} />
          Échéance proche d&apos;abord
        </button>
      </div>

      <div className="n-liste">
        {offres === null && [0, 1, 2].map((i) => <SqueletteOffre key={i} />)}

        {visibles.map((o) => {
          const mienne = moi?.id === o.posteur?.id;
          const admin = moi?.role === "admin";
          return (
            <article key={o.id} id={`o-${o.id}`} className="fiche demande" style={{ cursor: "default" }}>
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
                  <a href={lienAbsolu(o.lien)} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12.5, color: "var(--or-clair)", textDecoration: "underline", textUnderlineOffset: 3, display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8 }}>
                    Voir l&apos;annonce <ExternalLink size={12} aria-hidden />
                  </a>
                )}
                {o.fichiers?.length > 0 && (
                  <div className="o-fichiers">
                    {o.fichiers.map((f) => (
                      <a key={f.id} className="o-fichier" href={urlPublique(f.chemin)}
                        target="_blank" rel="noopener noreferrer" download={f.nom}>
                        {f.type === "application/pdf"
                          ? <FileText size={14} aria-hidden />
                          : <ImageIcon size={14} aria-hidden />}
                        <span className="o-fichier-nom">{f.nom}</span>
                      </a>
                    ))}
                  </div>
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
                  <button className="btn btn-nu" style={{ padding: "8px 10px", fontSize: 12 }}
                    onClick={() => partager(o)} aria-label="Partager l'offre">
                    <Share2 size={13} aria-hidden />
                  </button>
                  {mienne && (
                    <button className="btn btn-nu" style={{ padding: "8px 10px", fontSize: 12 }}
                      onClick={() => modifier(o)} aria-label="Modifier l'offre">
                      <Pencil size={13} aria-hidden />
                    </button>
                  )}
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
            <b>Aucune offre pour le moment</b>{" "}
            Un stage dans ta boîte, une bourse repérée, une cooptation ?<br />
            Sois le premier à partager une opportunité.
          </div>
        )}
      </div>

      <RestaurerDefilement />
      <div className={`toast${toast ? " la" : ""}`} role="status">{toast}</div>
    </>
  );
}
