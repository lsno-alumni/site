"use client";

import { useEffect, useState } from "react";
import { creerClientNavigateur } from "@/lib/supabase/client";
import ComptesEssai from "./ComptesEssai";

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

// les deux listes de comptes dépliables sous « État du système »
const LISTES = {
  fantomes: {
    rpc: "admin_liste_fantomes", migration: 49,
    intro: "Email jamais confirmé depuis plus de 30 jours : ces comptes seront supprimés le 1er du mois. Pour en garder un, confirme son email dans « Gérer un membre ».",
  },
  nonConfirmes: {
    rpc: "admin_liste_non_confirmes", migration: 50,
    intro: "Tous les comptes dont l'email n'a jamais été confirmé, du plus récent au plus ancien. Un membre dans ce cas peut ne pas réussir à se connecter : confirme son email à la main dans « Gérer un membre ».",
  },
};
const STATUTS = { valide: "validé", en_attente: "en attente de validation", suspendu: "suspendu" };

const CLE_EMAILS = "emails_inscription_admins";  // les EMAILS aux admins
const CLE_PUSH   = "push_inscription_admins";    // les NOTIFICATIONS aux admins (migration 45)
const CLE_ESSAI = "push_mode_essai";               // mode essai : notifications limitées aux admins + comptes de test (migration 63)

// fichiers et octets par bucket (photos, ressources, medias, pieces) : le
// palier gratuit s'arrête à 1 Go, on s'inquiète à partir de 700 Mo
const NOMS_BUCKETS = { photos: "Photos de profil", ressources: "Ressources", medias: "Fil (photos, vidéos) et photos de groupe", pieces: "Pièces jointes des messages" };
const SEUIL_MO = 700;
function Stockage() {
  const [liste, setListe] = useState(null);
  useEffect(() => { import("@/lib/messages").then(({ adminStockage }) => adminStockage().then(setListe).catch(() => setListe([]))); }, []);
  const total = (liste ?? []).reduce((s, b) => s + Number(b.octets), 0);
  const mo = (o) => (o / 1048576).toFixed(1).replace(".", ",") + " Mo";
  const alerte = total > SEUIL_MO * 1048576;
  return (
    <div className="carte-sombre" style={{ padding: "10px 14px", marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 12.5 }}>
        <b>Stockage</b>
        <span style={{ color: alerte ? "var(--rouge)" : "var(--texte-2)" }}>{liste === null ? "…" : `${mo(total)} / 1 Go${alerte ? " — proche de la limite" : ""}`}</span>
      </div>
      {liste?.map((b) => (
        <div key={b.bucket} style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--brume)", padding: "4px 0" }}>
          <span style={{ flex: 1 }}>{NOMS_BUCKETS[b.bucket] ?? b.bucket}</span>
          <span>{b.fichiers} fichier{b.fichiers > 1 ? "s" : ""}</span>
          <span style={{ minWidth: 64, textAlign: "right", color: "var(--texte-2)" }}>{mo(Number(b.octets))}</span>
        </div>
      ))}
      {liste?.length === 0 && <p style={{ fontSize: 12, color: "var(--brume)" }}>Rien à afficher (réservé aux modérateurs).</p>}
    </div>
  );
}

export default function EtatSysteme() {
  const supabase = creerClientNavigateur();
  const [etat, setEtat] = useState(null);
  const [emailsAdmins, setEmailsAdmins] = useState(null); // null = réglage absent
  const [pushAdmins, setPushAdmins] = useState(null);     // idem (migration 45)
  const [modeEssai, setModeEssai] = useState(null);       // idem (migration 63)
  const [bascule, setBascule] = useState("");             // clé en cours de bascule
  const [testPush, setTestPush] = useState("");
  // liste de comptes dépliée : null = aucune ; sinon { quoi, donnees } avec
  // donnees = "…" (chargement), tableau, ou "absente" (erreur : motif dans erreur)
  const [liste, setListe] = useState(null);

  useEffect(() => {
    supabase.rpc("admin_etat_systeme").then(({ data }) => setEtat(data ?? false));
    supabase.from("reglages").select("cle, actif").in("cle", [CLE_EMAILS, CLE_PUSH, CLE_ESSAI])
      .then(({ data }) => {
        const lu = (cle) => (data ?? []).find((r) => r.cle === cle);
        setEmailsAdmins(lu(CLE_EMAILS) ? lu(CLE_EMAILS).actif : null);
        setPushAdmins(lu(CLE_PUSH) ? lu(CLE_PUSH).actif : null);
        setModeEssai(lu(CLE_ESSAI) ? lu(CLE_ESSAI).actif : null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const basculer = async (cle, valeur, poser) => {
    setBascule(cle);
    const { error } = await supabase.from("reglages")
      .update({ actif: !valeur, maj_le: new Date().toISOString() }).eq("cle", cle);
    if (!error) poser((v) => !v);
    setBascule("");
  };

  const ouvrirListe = async (quoi) => {
    if (liste?.quoi === quoi) { setListe(null); return; }
    setListe({ quoi, donnees: "…" });
    const { data, error } = await supabase.rpc(LISTES[quoi].rpc);
    setListe({ quoi, donnees: error ? "absente" : (data ?? []), erreur: error?.message });
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
      <Stockage />
      <div className="carte-sombre" style={{ padding: "6px 14px" }}>
        {(etat.jobs ?? []).map((j) => {
          const ok = !j.derniere || j.derniere.statut === "succeeded";
          return (
            <div key={j.nom} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "8px 0", borderBottom: "1px solid var(--ligne)", fontSize: 12.5 }}>
              <span aria-hidden style={{ color: ok ? "#9FD8B4" : "var(--rouge)" }}>{ok ? "✓" : "✗"}</span>
              <span style={{ flex: 1, color: "var(--texte-2)" }}>{NOMS[j.nom] ?? j.nom}</span>
              <span style={{ color: ok ? "var(--brume)" : "var(--rouge)", whiteSpace: "nowrap" }}>
                {j.derniere ? `${date(j.derniere.quand)}${ok ? "" : " — échec"}` : "en attente"}
              </span>
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 14, padding: "10px 0", fontSize: 12.5, color: "var(--brume)", flexWrap: "wrap" }}>
          <span>
            Comptes fantômes à purger : <b style={{ color: "var(--texte)" }}>{etat.fantomes}</b>
            {etat.fantomes > 0 && (
              <button type="button" onClick={() => ouvrirListe("fantomes")}
                style={{ background: "none", border: "none", padding: "0 0 0 8px", cursor: "pointer",
                  color: "var(--bleu-texte)", fontSize: 12.5, textDecoration: "underline", textUnderlineOffset: 3 }}>
                {liste?.quoi === "fantomes" ? "masquer" : "voir la liste"}
              </button>
            )}
          </span>
          {etat.non_confirmes !== undefined && (
            <span>
              Emails jamais confirmés : <b style={{ color: "var(--texte)" }}>{etat.non_confirmes}</b>
              {etat.non_confirmes > 0 && (
                <button type="button" onClick={() => ouvrirListe("nonConfirmes")}
                style={{ background: "none", border: "none", padding: "0 0 0 8px", cursor: "pointer",
                  color: "var(--bleu-texte)", fontSize: 12.5, textDecoration: "underline", textUnderlineOffset: 3 }}>
                {liste?.quoi === "nonConfirmes" ? "masquer" : "voir la liste"}
              </button>
              )}
            </span>
          )}
          <span>Offres expirant sous 14 j : <b style={{ color: "var(--texte)" }}>{etat.offres_expirent_14j}</b></span>
        </div>
        {liste !== null && (
          <div style={{ borderTop: "1px solid var(--ligne)", padding: "10px 0 12px", display: "grid", gap: 8, fontSize: 12.5 }}>
            {liste.donnees === "…" && <span style={{ color: "var(--brume)" }}>Chargement…</span>}
            {liste.donnees === "absente" && (
              <span style={{ color: "var(--bleu-texte)", lineHeight: 1.5 }}>
                Liste indisponible. Si la migration{" "}{LISTES[liste.quoi].migration}{" "}n&apos;a pas encore
                été exécutée dans Supabase, c&apos;est la cause la plus probable.
                {liste.erreur && <span style={{ display: "block", color: "var(--brume)", fontSize: 11.5, marginTop: 4, overflowWrap: "anywhere" }}>Détail : {liste.erreur}</span>}
              </span>
            )}
            {Array.isArray(liste.donnees) && (
              <>
                <span style={{ color: "var(--brume)", lineHeight: 1.5 }}>{LISTES[liste.quoi].intro}</span>
                {liste.donnees.length === 0 && <span style={{ color: "var(--brume)" }}>Plus aucun compte concerné.</span>}
                {liste.donnees.map((f) => (
                  <div key={f.email} style={{ background: "rgba(245,241,232,.05)", border: "1px solid var(--ligne)", borderRadius: 12, padding: "9px 11px" }}>
                    <b style={{ color: "var(--texte)", overflowWrap: "anywhere" }}>{f.email}</b>
                    <span style={{ display: "block", color: "var(--brume)", fontSize: 12, marginTop: 2, lineHeight: 1.5 }}>
                      Inscrit le {new Date(f.cree_le).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                      {f.prenom ? ` · ${f.prenom} ${f.nom ?? ""}`.trimEnd() : " · profil jamais rempli"}
                      {f.promotion ? ` · Promo ${f.promotion}` : ""}
                      {f.statut ? ` · ${STATUTS[f.statut] ?? f.statut}` : ""}
                    </span>
                    {f.sera_purge && (
                      <span style={{ display: "block", color: "var(--rouge)", fontSize: 12, marginTop: 2 }}>
                        Sera supprimé à la purge du 1er du mois
                      </span>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Interrupteur des EMAILS « nouvelle inscription » vers les admins.
          À couper le jour d'un lancement de promo entière (les délégués prennent
          le relais) — les emails des délégués ne changent JAMAIS.
          ⚠ Il ne touche QUE les emails depuis la migration 45 : les
          notifications ont leur propre interrupteur, plus bas. C'est justement
          parce que les notifications existent qu'on peut se passer des emails. */}
      {emailsAdmins !== null && (
        <div className="carte-sombre" style={{ padding: 14, marginTop: 12, display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 190, fontSize: 13 }}>
              <b>Emails d&apos;inscription aux admins</b>
              <span style={{ display: "block", color: "var(--brume)", fontSize: 12, lineHeight: 1.5, marginTop: 2 }}>
                {emailsAdmins
                  ? "Actifs : tu reçois un email à chaque nouvelle demande."
                  : "En pause : plus d'email. Les notifications, elles, continuent si l'interrupteur plus bas est actif — et les promotions sans délégué te sont signalées dans tous les cas."}
              </span>
            </span>
            <button className={`btn ${emailsAdmins ? "btn-nu" : "btn-or"}`}
              style={{ padding: "9px 15px", fontSize: 12.5 }}
              onClick={() => basculer(CLE_EMAILS, emailsAdmins, setEmailsAdmins)} disabled={Boolean(bascule)}>
              {bascule === CLE_EMAILS ? "…" : emailsAdmins ? "Mettre en pause" : "Réactiver"}
            </button>
          </div>
          {/* le rappel appartient à l'interrupteur : il doit le suivre
              immédiatement, et non se retrouver en bas de la carte */}
          {!emailsAdmins && (
            <p style={{ fontSize: 12, color: "var(--bleu-texte)", lineHeight: 1.5, margin: 0 }}>
              ⏸ En pause : à réactiver quand tu veux suivre à nouveau chaque inscription par email.
            </p>
          )}
        </div>
      )}

      {/* Notifications : l'interrupteur des notifications d'inscription, puis le
          test de bout en bout. Séparé des emails depuis la migration 45 — lier
          les deux revenait à retirer d'une main ce qu'on donnait de l'autre. */}
      <div className="carte-sombre" style={{ padding: 14, marginTop: 12, display: "grid", gap: 10 }}>
        <span style={{ fontSize: 13 }}>
          <b>Notifications</b>
        </span>

        {pushAdmins !== null && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                        borderTop: "1px solid var(--ligne)", paddingTop: 10 }}>
            <span style={{ flex: 1, minWidth: 190, fontSize: 13 }}>
              <b>Notifications d&apos;inscription aux admins</b>
              <span style={{ display: "block", color: "var(--brume)", fontSize: 12, lineHeight: 1.5, marginTop: 2 }}>
                {pushAdmins
                  ? "Actives : ton téléphone sonne à chaque nouvelle demande, même emails en pause."
                  : "En pause : plus de notification d’inscription — les promotions sans délégué te sont quand même signalées."}
              </span>
            </span>
            <button className={`btn ${pushAdmins ? "btn-nu" : "btn-or"}`}
              style={{ padding: "9px 15px", fontSize: 12.5 }}
              onClick={() => basculer(CLE_PUSH, pushAdmins, setPushAdmins)} disabled={Boolean(bascule)}>
              {bascule === CLE_PUSH ? "…" : pushAdmins ? "Mettre en pause" : "Réactiver"}
            </button>
          </div>
        )}

        {modeEssai !== null && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                        borderTop: "1px solid var(--ligne)", paddingTop: 10 }}>
            <span style={{ flex: 1, minWidth: 190, fontSize: 13 }}>
              <b>Mode essai des notifications</b>
              <span style={{ display: "block", color: modeEssai ? "var(--rouge)" : "var(--brume)", fontSize: 12, lineHeight: 1.5, marginTop: 2 }}>
                {modeEssai
                  ? "Actif : seuls les administrateurs et les comptes de test reçoivent des notifications. Les autres membres ne sont pas dérangés — pense à l’éteindre après les essais."
                  : "Éteint : tout le monde reçoit ses notifications. À activer le temps d’un essai sur la vraie base."}
              </span>
            </span>
            <button className={`btn ${modeEssai ? "btn-or" : "btn-nu"}`}
              style={{ padding: "9px 15px", fontSize: 12.5 }}
              onClick={() => basculer(CLE_ESSAI, modeEssai, setModeEssai)} disabled={Boolean(bascule)}>
              {bascule === CLE_ESSAI ? "…" : modeEssai ? "Éteindre" : "Activer"}
            </button>
          </div>
        )}
        {modeEssai !== null && <ComptesEssai actif={modeEssai} />}

        <span style={{ display: "block", color: "var(--brume)", fontSize: 12, lineHeight: 1.5,
                       borderTop: "1px solid var(--ligne)", paddingTop: 10 }}>
          Vérifier que la chaîne complète fonctionne, de la base à ton téléphone.
        </span>
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
      </div>
    </>
  );
}
