"use client";

import { useEffect, useState } from "react";
import { creerClientNavigateur } from "@/lib/supabase/client";

// Journal des actions à privilège (migration 36). Replié par défaut : la page
// admin est déjà longue, on n'y ajoute que deux lignes tant qu'on ne l'ouvre pas.
// Lecture réservée aux admins par la politique RLS — inutile de la refaire ici.

const PAR_PAGE = 20;

// libellés : le journal stocke des codes courts, l'écran parle français
const ACTIONS = {
  validation: "Validation d'un compte",
  refus: "Demande refusée",
  suspension: "Compte suspendu",
  reactivation: "Compte réactivé",
  statut: "Statut modifié",
  role: "Rôle modifié",
  suppression: "Compte supprimé",
  suppression_soi: "Compte supprimé par son propriétaire",
  email_confirme: "Email confirmé à la main",
  email_change: "Email de connexion changé",
  mdp_temporaire: "Mot de passe temporaire posé",
  annonce: "Annonce publiée",
  reglage: "Réglage modifié",
  export: "Export de la base",
};

const ROLES = { membre: "membre", delegue: "délégué·e", admin: "admin" };
const STATUTS = { en_attente: "en attente", valide: "validé", suspendu: "suspendu" };

// une phrase lisible plutôt qu'un objet JSON brut
function precision(l) {
  const d = l.details ?? {};
  switch (l.action) {
    case "role":
      return `${ROLES[d.avant] ?? d.avant} → ${ROLES[d.apres] ?? d.apres}`;
    case "statut":
      return `${STATUTS[d.avant] ?? d.avant} → ${STATUTS[d.apres] ?? d.apres}`;
    case "email_change":
      return `${d.avant ?? "?"} → ${d.apres ?? "?"}`;
    case "annonce":
      return d.sujet ?? "";
    case "reglage":
      return `${d.cle} : ${d.actif ? "activé" : "désactivé"}`;
    case "export":
      return `${d.profils ?? "?"} profils, ${d.parcours ?? 0} parcours téléchargés`;
    case "suppression":
    case "suppression_soi":
      return d.promo ? `promotion ${d.promo}` : "";
    default:
      return "";
  }
}

const quand = (t) =>
  new Date(t).toLocaleString("fr-FR", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });

// Une ligne du journal, réutilisée par la fiche d'un membre (voir plus bas).
export function LigneJournal({ l, sansCible = false }) {
  const p = precision(l);
  return (
    <div style={{ padding: "9px 0", borderTop: "1px solid var(--ligne)", fontSize: 12.5, lineHeight: 1.45 }}>
      <b style={{ color: "var(--craie)" }}>{ACTIONS[l.action] ?? l.action}</b>
      {!sansCible && l.cible_nom && <span style={{ color: "var(--craie-2)" }}> · {l.cible_nom}</span>}
      <div style={{ color: "var(--brume)", fontSize: 11.5, marginTop: 2, overflowWrap: "anywhere" }}>
        par {l.acteur_nom ?? "(système)"} · {quand(l.quand)}
        {p && <> · {p}</>}
      </div>
    </div>
  );
}

// Historique d'UN membre — posé dans sa fiche, replié tant qu'on ne l'ouvre pas.
export function HistoriqueMembre({ profilId }) {
  const supabase = creerClientNavigateur();
  const [ouvert, setOuvert] = useState(false);
  const [lignes, setLignes] = useState(null);

  useEffect(() => { setOuvert(false); setLignes(null); }, [profilId]);

  const basculer = async () => {
    if (ouvert) { setOuvert(false); return; }
    setOuvert(true);
    if (lignes) return;
    const { data } = await supabase
      .from("journal").select("*").eq("cible", profilId)
      .order("quand", { ascending: false }).limit(30);
    setLignes(data ?? []);
  };

  return (
    <div style={{ borderTop: "1px solid var(--ligne)", paddingTop: 10 }}>
      <button type="button" onClick={basculer}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer",
                 color: "var(--brume)", font: "inherit", fontSize: 12.5,
                 textDecoration: "underline", textUnderlineOffset: 3 }}>
        Historique de ce compte {ouvert ? "▾" : "▸"}
      </button>
      {ouvert && (
        lignes === null ? (
          <p style={{ fontSize: 12, color: "var(--brume)", marginTop: 8 }}>Lecture…</p>
        ) : lignes.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--brume)", marginTop: 8 }}>
            Aucune action enregistrée — le journal a commencé le jour de sa mise en place.
          </p>
        ) : (
          <div style={{ marginTop: 6 }}>
            {lignes.map((l) => <LigneJournal key={l.id} l={l} sansCible />)}
          </div>
        )
      )}
    </div>
  );
}

export default function Journal() {
  const supabase = creerClientNavigateur();
  const [derniere, setDerniere] = useState(null);   // aperçu : la dernière action
  const [lignes, setLignes] = useState([]);
  const [ouvert, setOuvert] = useState(false);
  const [filtre, setFiltre] = useState("");
  const [fini, setFini] = useState(false);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    supabase.from("journal").select("*").order("quand", { ascending: false }).limit(1)
      .then(({ data }) => setDerniere(data?.[0] ?? false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const charger = async (depuisZero = false) => {
    setEnCours(true);
    let req = supabase.from("journal").select("*").order("quand", { ascending: false });
    if (filtre) req = req.eq("action", filtre);
    const debut = depuisZero ? 0 : lignes.length;
    const { data } = await req.range(debut, debut + PAR_PAGE - 1);
    const recu = data ?? [];
    setLignes(depuisZero ? recu : [...lignes, ...recu]);
    setFini(recu.length < PAR_PAGE);
    setEnCours(false);
  };

  const ouvrir = () => { setOuvert(true); charger(true); };
  const changerFiltre = (v) => { setFiltre(v); setLignes([]); setFini(false); };
  useEffect(() => { if (ouvert) charger(true); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtre]);

  return (
    <>
      <h2 className="a-titre" style={{ marginTop: 22 }}>Journal des actions</h2>
      <p style={{ fontSize: 12.5, color: "var(--brume)", marginTop: -6 }}>
        Qui a validé, suspendu, supprimé, exporté. Conservé 12 mois, en ajout seul :
        personne ne peut modifier ni effacer une ligne.
      </p>

      {!ouvert ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: "var(--craie-2)", flex: 1, minWidth: 160 }}>
            {derniere === null ? "…"
              : derniere === false ? "Aucune action enregistrée pour l'instant."
              : <>Dernière : <b>{ACTIONS[derniere.action] ?? derniere.action}</b>
                  {derniere.cible_nom ? ` · ${derniere.cible_nom}` : ""} · {quand(derniere.quand)}</>}
          </span>
          <button className="btn btn-nu" style={{ padding: "9px 13px", fontSize: 12 }} onClick={ouvrir}>
            Voir tout
          </button>
        </div>
      ) : (
        <div className="carte-sombre" style={{ padding: 14 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select className="saisie" style={{ flex: 1, minWidth: 150, padding: "9px 12px", fontSize: 12.5 }}
              value={filtre} onChange={(e) => changerFiltre(e.target.value)} aria-label="Filtrer par type d'action">
              <option value="">Toutes les actions</option>
              {Object.entries(ACTIONS).map(([cle, nom]) => (
                <option key={cle} value={cle}>{nom}</option>
              ))}
            </select>
            <button className="btn btn-nu" style={{ padding: "9px 13px", fontSize: 12 }}
              onClick={() => setOuvert(false)}>Replier</button>
          </div>

          {lignes.length === 0 && !enCours && (
            <p style={{ fontSize: 12.5, color: "var(--brume)", marginTop: 12 }}>
              Rien à afficher{filtre ? " pour ce type d'action" : ""}.
            </p>
          )}
          <div style={{ marginTop: 6 }}>
            {lignes.map((l) => <LigneJournal key={l.id} l={l} />)}
          </div>
          {!fini && (
            <button className="btn btn-nu" style={{ padding: "9px 13px", fontSize: 12, marginTop: 12 }}
              onClick={() => charger()} disabled={enCours}>
              {enCours ? "Lecture…" : "Charger 20 de plus"}
            </button>
          )}
        </div>
      )}
    </>
  );
}
