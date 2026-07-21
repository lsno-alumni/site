"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Avatar from "@/components/Avatar";
import { Search, BadgeCheck, Lightbulb, ArrowRight } from "lucide-react";
import { DOMAINES, PAYS, LISTE_PAYS, nomPays, nomDomaine, PROMOTIONS, SITUATIONS } from "@/lib/donnees";

const FILTRES_DOMAINE = [
  { cle: "tous", nom: "Tous" },
  ...DOMAINES.map((d) => ({ cle: d.cle, nom: d.nom.split(" &")[0] })),
];

export default function Annuaire({ membres }) {
  const params = useSearchParams();
  const [domaine, setDomaine] = useState(params.get("domaine") ?? "tous");
  const [promo, setPromo] = useState(params.get("promo") ?? "");
  const [pays, setPays] = useState(params.get("pays") ?? "");
  const [situation, setSituation] = useState(params.get("situation") ?? "");
  const [q, setQ] = useState(params.get("q") ?? "");

  // les filtres vivent dans l'URL (sans navigation) : le retour depuis un
  // profil retrouve exactement la même liste
  useEffect(() => {
    const u = new URLSearchParams();
    if (domaine !== "tous") u.set("domaine", domaine);
    if (promo) u.set("promo", promo);
    if (pays) u.set("pays", pays);
    if (situation) u.set("situation", situation);
    if (q.trim()) u.set("q", q.trim());
    const suffixe = u.toString();
    window.history.replaceState(null, "", suffixe ? `/annuaire?${suffixe}` : "/annuaire");
  }, [domaine, promo, pays, situation, q]);

  // recherche qui pardonne : minuscules ET sans accents (« economie » trouve « Économie »)
  const plat = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const resultats = useMemo(() => {
    const t = plat(q.trim());
    return membres.filter((m) => {
      if (domaine !== "tous" && m.domaine !== domaine) return false;
      if (promo && m.promotion !== Number(promo)) return false;
      if (pays && m.pays !== pays) return false;
      if (situation && m.situation !== situation) return false;
      if (t) {
        const texte = plat([
          m.prenom, m.nom, m.statut, m.ville, nomPays(m.pays ?? ""),
          nomDomaine(m.domaine, m.domainePrecision), // « informatique », « aviation »…
        ].join(" "));
        if (!texte.includes(t)) return false;
      }
      return true;
    });
  }, [membres, domaine, promo, pays, situation, q]);

  const raz = () => { setDomaine("tous"); setPromo(""); setPays(""); setSituation(""); setQ(""); };

  return (
    <>
      <header className="n-tete">
        <h1>Les anciens</h1>
        <p className="cpt">
          {resultats.length > 0
            ? `${resultats.length} profil${resultats.length > 1 ? "s" : ""}`
            : "Aucun profil"}
        </p>
        <div className="n-cherche">
          <Search size={16} strokeWidth={1.8} aria-hidden style={{ color: "var(--brume)", flexShrink: 0 }} />
          <input
            type="search"
            placeholder="Nom, école, ville, spécialité…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Rechercher un ancien"
          />
        </div>
        <Link href="/conseils" className="n-vers-conseils">
          <Lightbulb size={15} strokeWidth={1.9} aria-hidden />
          Leurs conseils aux cadets
          <ArrowRight size={14} aria-hidden style={{ marginLeft: "auto" }} />
        </Link>
      </header>

      <div className="n-filtres" role="group" aria-label="Filtrer par domaine">
        {FILTRES_DOMAINE.map((f) => (
          <button
            key={f.cle}
            className={`puce${domaine === f.cle ? " active" : ""}`}
            onClick={() => setDomaine(f.cle)}
          >
            {f.nom}
          </button>
        ))}
      </div>

      <div className="n-filtres" style={{ position: "static", paddingTop: 0 }}>
        <select className="puce" value={promo} onChange={(e) => setPromo(e.target.value)} aria-label="Filtrer par promotion">
          <option value="">Promo — toutes</option>
          {PROMOTIONS.map((p) => (
            <option key={p.numero} value={p.numero}>
              P{p.numero} {p.enCours ? "(en cours)" : `· Bac ${p.anneeBac}`}
            </option>
          ))}
        </select>
        <select className="puce" value={pays} onChange={(e) => setPays(e.target.value)} aria-label="Filtrer par pays">
          <option value="">Pays — tous</option>
          {LISTE_PAYS.filter(([code]) => membres.some((m) => m.pays === code)).map(([code, nom]) => (
            <option key={code} value={code}>{nom}</option>
          ))}
        </select>
        <select className="puce" value={situation} onChange={(e) => setSituation(e.target.value)} aria-label="Filtrer par situation">
          <option value="">Situation — toutes</option>
          {SITUATIONS.map((s) => (
            <option key={s.cle} value={s.cle}>{s.nom}</option>
          ))}
        </select>
      </div>

      <div className="n-liste">
        {resultats.map((m) => (
          <Link key={m.id} href={`/profil/${m.id}`} className="fiche">
            <div className="haut">
              <Avatar profil={m} className="init" />
              <div>
                <b>{m.prenom} {m.nom}</b>
                <div className="role">{m.statut}</div>
              </div>
            </div>
            <div className="pied">
              <span className="promo">Promo {m.promotion}</span>
              <span className="sep">·</span>
              <span>
                {PAYS[m.pays] && <img className="drapo" src={PAYS[m.pays].drapeau} alt="" />} {m.ville}
              </span>
              <span className="sep">·</span>
              <span>{nomDomaine(m.domaine, m.domainePrecision, true)}</span>
              {m.repondAuxCadets && (
                <span className="dispo">
                  <BadgeCheck size={13} strokeWidth={2} aria-hidden /> répond
                </span>
              )}
            </div>
          </Link>
        ))}
        {resultats.length === 0 && (
          <div className="vide">
            <div className="gros" aria-hidden><Search size={30} strokeWidth={1.6} /></div>
            <b>Personne ne correspond</b>
            Essaie un autre nom, une autre ville,<br />ou retire les filtres.
            <div style={{ marginTop: 14 }}>
              <button className="btn btn-nu" onClick={raz}>Tout afficher</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
