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
  "purge-offres-cloturees": "Purge des offres clôturées (mensuel)",
  "purge-journal": "Purge du journal au-delà de 12 mois (mensuel)",
  "purge-refus": "Purge des demandes refusées de plus de 90 jours (mensuel)",
  "controle-sante": "Contrôle de santé de la base (mensuel)",
  // notifications push
  "push-rappels-quotidiens": "Notifications : profils incomplets, offres qui expirent (quotidien)",
  "push-rappel-annuel": "Notification : profils à jour ? (1er septembre)",
  "push-controle-cles": "Notification : contrôle des clés (bimestriel)",
  "push-rentree-octobre": "Notifications de la rentrée (1er octobre)",
};

const CLE_EMAILS = "emails_inscription_admins";

export default function EtatSysteme() {
  const supabase = creerClientNavigateur();
  const [etat, setEtat] = useState(null);
  const [emailsAdmins, setEmailsAdmins] = useState(null); // null = réglage absent
  const [bascule, setBascule] = useState(false);
  const [testPush, setTestPush] = useState("");

  useEffect(() => {
    supabase.rpc("admin_etat_systeme").then(({ data }) => setEtat(data ?? false));
    supabase.from("reglages").select("actif").eq("cle", CLE_EMAILS).maybeSingle()
      .then(({ data }) => setEmailsAdmins(data ? data.actif : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const basculerEmails = async () => {
    setBascule(true);
    const { error } = await supabase.from("reglages")
      .update({ actif: !emailsAdmins, maj_le: new Date().toISOString() }).eq("cle", CLE_EMAILS);
    if (!error) setEmailsAdmins((v) => !v);
    setBascule(false);
  };

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

      {/* interrupteur : emails « nouvelle inscription » vers les admins.
          À couper le jour d'un lancement de promo entière (les délégués prennent
          le relais) — les emails des délégués ne changent pas. */}
      {emailsAdmins !== null && (
        <div className="carte-sombre" style={{ padding: 14, marginTop: 12, display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 190, fontSize: 13 }}>
              <b>Emails d&apos;inscription aux admins</b>
              <span style={{ display: "block", color: "var(--brume)", fontSize: 12, lineHeight: 1.5, marginTop: 2 }}>
                {emailsAdmins
                  ? "Actifs : tu reçois un email à chaque nouvelle demande."
                  : "En pause : seuls les délégués sont prévenus (les promotions sans délégué te sont quand même signalées)."}
              </span>
            </span>
            <button className={`btn ${emailsAdmins ? "btn-nu" : "btn-or"}`}
              style={{ padding: "9px 15px", fontSize: 12.5 }}
              onClick={basculerEmails} disabled={bascule}>
              {bascule ? "…" : emailsAdmins ? "Mettre en pause" : "Réactiver"}
            </button>
          </div>
          <button type="button" className="btn btn-nu" style={{ padding: "9px 15px", fontSize: 12.5, justifySelf: "start" }}
            onClick={async () => {
              const { error } = await supabase.rpc("admin_test_push");
              setTestPush(error ? "Échec : " + error.message
                : "Envoyée — si rien n'arrive, active les notifications dans Mon profil.");
            }}>
            M&apos;envoyer une notification de test
          </button>
          {testPush && (
            <p style={{ fontSize: 12, color: "var(--brume)", margin: 0, lineHeight: 1.5 }}>{testPush}</p>
          )}
          {!emailsAdmins && (
            <p style={{ fontSize: 12, color: "var(--or-clair)", lineHeight: 1.5, margin: 0 }}>
              ⏸ En pause : à réactiver quand tu veux suivre à nouveau chaque inscription.
            </p>
          )}
        </div>
      )}
    </>
  );
}
