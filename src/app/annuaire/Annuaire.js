"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Avatar from "@/components/Avatar";
import { RestaurerDefilement } from "@/components/SuiviNavigation";
import GlisserRafraichir from "@/components/GlisserRafraichir";
import Surligne, { plat } from "@/components/Surligne";
import { Search, BadgeCheck, Lightbulb, ArrowRight, Shuffle } from "lucide-react";
import { DOMAINES, PAYS, LISTE_PAYS, nomPays, nomDomaine, PROMOTIONS, SITUATIONS } from "@/lib/donnees";

const FILTRES_DOMAINE = [
  { cle: "tous", nom: "Tous" },
  ...DOMAINES.map((d) => ({ cle: d.cle, nom: d.nom.split(" &")[0] })),
  { cle: "eleve", nom: "Élèves" }, // membres encore au lycée (pas encore de domaine)
];

export default function Annuaire({ membres }) {
  const routeur = useRouter();
  const params = useSearchParams();
  // Posé par l'effet ci-dessous, jamais lu directement depuis `params` au
  // premier rendu : avec Cache Components, la coquille statique peut peindre
  // AVANT que la vraie query string ne soit connue côté client — lire
  // `params.get(...)` ici capturait alors un "vide" figé (le filtre venu
  // d'un lien externe, ex. la roue de l'accueil, ne s'appliquait plus).
  const [domaine, setDomaine] = useState("tous");
  // Cache Components garde cette page en mémoire au lieu de la détruire :
  // revenir depuis un AUTRE onglet ne remonte plus le composant, donc un
  // filtre choisi ICI reste affiché — voulu. Mais un domaine arrivé par un
  // lien EXTERNE (roue de l'accueil) ne doit pas rester accroché
  // indéfiniment : cette ref dit si le domaine affiché vient de la dernière
  // VRAIE navigation (pas d'un choix ici même) — recalculée à chaque fois
  // que l'URL suivie par Next change réellement (jamais par nos propres
  // replaceState de synchronisation ci-dessous, qui ne la font pas bouger).
  const domaineVenuDAilleurs = useRef(false);
  useEffect(() => {
    const d = params.get("domaine");
    if (d != null) {
      setDomaine(d); // eslint-disable-line react-hooks/set-state-in-effect -- synchronise depuis l'URL, pas un état interne
      domaineVenuDAilleurs.current = true;
    } else if (domaineVenuDAilleurs.current) {
      setDomaine("tous");
      domaineVenuDAilleurs.current = false;
    }
  }, [params]);
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
    const cible = suffixe ? `/annuaire?${suffixe}` : "/annuaire";
    // ne pas toucher à l'historique si l'URL est déjà la bonne (cas du montage) :
    // chaque replaceState réinitialise la position de défilement mémorisée.
    if (window.location.pathname + window.location.search === cible) return;
    // ⚠ conserver l'état existant : passer null effacerait l'état interne de
    // Next.js, qui y garde la position de défilement pour le retour arrière.
    window.history.replaceState(window.history.state, "", cible);
  }, [domaine, promo, pays, situation, q]);

  const resultats = useMemo(() => {
    const t = plat(q.trim());
    return membres.filter((m) => {
      if (domaine !== "tous" && m.domaine !== domaine) return false;
      if (promo && m.promotion !== Number(promo)) return false;
      if (pays && m.pays !== pays) return false;
      // filtre situation : « Élève » = les lycéens ; les 4 vraies situations
      // excluent les élèves (leur « etudiant » en base n'est qu'un défaut)
      if (situation) {
        const estEleveMembre = m.domaine === "eleve" || m.situation === "eleve";
        if (situation === "eleve" ? !estEleveMembre : (estEleveMembre || m.situation !== situation)) return false;
      }
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

  // ouvre le profil d'un membre pris au hasard PARMI LES RÉSULTATS actuels
  // (respecte les filtres/la recherche en cours) — depuis l'annuaire, ce
  // lien est intercepté et s'ouvre en feuille, comme n'importe quelle fiche
  const verHasard = () => {
    if (resultats.length === 0) return;
    const m = resultats[Math.floor(Math.random() * resultats.length)];
    routeur.push(`/profil/${m.id}`);
  };

  // recharge la liste depuis le serveur (nouveaux membres, changements de
  // profil…) ; un délai minimum garde l'indicateur visible un instant même
  // si la réponse arrive très vite, pour que le geste se sente confirmé
  const rafraichir = () => {
    routeur.refresh();
    return new Promise((r) => setTimeout(r, 600));
  };

  return (
    <GlisserRafraichir onRafraichir={rafraichir}>
    <>
      <header className="n-tete">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <h1>Les anciens</h1>
          <Link href="/conseils" className="n-vers-conseils">
            <Lightbulb size={14} strokeWidth={1.9} aria-hidden /> Conseils
          </Link>
        </div>
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
          <button type="button" className="n-hasard" onClick={verHasard}
            disabled={resultats.length === 0} aria-label="Découvrir un profil au hasard">
            <Shuffle size={16} strokeWidth={1.8} aria-hidden />
          </button>
        </div>
      </header>

      <div className="n-filtres" role="group" aria-label="Filtrer par domaine">
        {FILTRES_DOMAINE.map((f) => (
          <button
            key={f.cle}
            className={`puce${domaine === f.cle ? " active" : ""}`}
            onClick={() => { domaineVenuDAilleurs.current = false; setDomaine(f.cle); }}
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
          <option value="eleve">Élève</option>
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
                <b><Surligne texte={`${m.prenom} ${m.nom}`} terme={q} /></b>
                <div className="role"><Surligne texte={m.statut} terme={q} /></div>
              </div>
            </div>
            <div className="pied">
              <span className="promo">Promo {m.promotion}</span>
              <span className="sep">·</span>
              <span>
                {PAYS[m.pays] && <img className="drapo" src={PAYS[m.pays].drapeau} alt="" />} <Surligne texte={m.ville} terme={q} />
              </span>
              <span className="sep">·</span>
              <span><Surligne texte={nomDomaine(m.domaine, m.domainePrecision, true)} terme={q} /></span>
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
            <b>Personne ne correspond</b>{" "}
            Essaie un autre nom, une autre ville,<br />ou retire les filtres.
            <div style={{ marginTop: 14 }}>
              <button className="btn btn-nu" onClick={raz}>Tout afficher</button>
            </div>
          </div>
        )}
      </div>
      <RestaurerDefilement />
    </>
    </GlisserRafraichir>
  );
}
