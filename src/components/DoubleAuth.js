"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { creerClientNavigateur } from "@/lib/supabase/client";

// Double authentification (code à six chiffres) pour les comptes à privilège.
// Proposée aux délégués et aux administrateurs seulement : ce sont les comptes
// dont la perte du mot de passe a des conséquences pour tout le réseau. Un
// membre n'a rien à régler ici, son écran reste simple.
//
// ⚠ Portée exacte de ce qui est protégé : le site demande le code à la connexion
// dès qu'un appareil est enrôlé. C'est la protection du parcours normal. Exiger
// le code au niveau de la BASE (politiques RLS) est une étape distincte, à faire
// séparément — sinon un mot de passe volé permettrait encore d'attaquer l'API
// directement, sans passer par nos écrans.
//
// Comportement vérifié en réel (01/08, cycle complet joué contre l'API) :
//   • connexion par mot de passe seul  → session de niveau « aal1 »
//   • code confirmé                    → « aal2 »
//   • RAFRAÎCHISSEMENT de la session   → reste « aal2 »
//     Autrement dit : fermer l'appli et la rouvrir ne redemande RIEN. Le code
//     n'est demandé qu'à une nouvelle connexion par mot de passe.
//   • désactivation depuis une session confirmée → acceptée
// Rien n'est obligatoire : un délégué peut ne jamais l'activer, et la retirer
// après l'avoir activée.

export default function DoubleAuth({ profil }) {
  const supabase = creerClientNavigateur();
  const [facteur, setFacteur] = useState(undefined); // undefined = on cherche
  const [enrolement, setEnrolement] = useState(null); // { id, qr, secret, uri }
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState(false);

  const privilege = profil?.role === "admin" || profil?.role === "delegue";

  const relire = async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) { setFacteur(null); return; }
    // « all » et non « totp » : ce dernier ne contient que les appareils CONFIRMÉS,
    // donc un enrôlement inachevé y est invisible (constaté à l'usage).
    const tous = data?.all ?? data?.totp ?? [];
    setFacteur(tous.find((f) => f.factor_type === "totp" && f.status === "verified") ?? null);
  };

  useEffect(() => {
    if (privilege) relire();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [privilege]);

  if (!privilege) return null;

  const commencer = async () => {
    setEnCours(true); setMessage("");
    // On nettoie les enrôlements inachevés, sinon ils s'accumulent. Lire « all » :
    // « totp » ne contient que les appareils confirmés, donc un enrôlement
    // abandonné y est invisible — et Supabase refusait ensuite le suivant.
    const { data: liste } = await supabase.auth.mfa.listFactors();
    for (const f of liste?.all ?? []) {
      if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    // Nom unique à la seconde : deux tentatives le même jour se heurtaient à
    // l'erreur « a factor with the friendly name … already exists ».
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "LSNO Amicale " + new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-"),
    });
    setEnCours(false);
    if (error) { setMessage("Impossible de commencer : " + error.message); return; }
    setEnrolement({ id: data.id, qr: data.totp?.qr_code, secret: data.totp?.secret, uri: data.totp?.uri });
  };

  const confirmer = async () => {
    setEnCours(true); setMessage("");
    const { data: def, error: e1 } = await supabase.auth.mfa.challenge({ factorId: enrolement.id });
    if (e1) { setEnCours(false); setMessage("Impossible de vérifier : " + e1.message); return; }
    const { error: e2 } = await supabase.auth.mfa.verify({
      factorId: enrolement.id, challengeId: def.id, code: code.trim(),
    });
    setEnCours(false);
    if (e2) { setMessage("Code refusé. Vérifie l'heure de ton téléphone, puis réessaie."); return; }
    setEnrolement(null); setCode("");
    setMessage("Double authentification activée ✓");
    relire();
  };

  const desactiver = async () => {
    if (!confirm("Désactiver la double authentification ? Ton compte ne sera plus protégé que par son mot de passe.")) return;
    setEnCours(true); setMessage("");
    const { error } = await supabase.auth.mfa.unenroll({ factorId: facteur.id });
    setEnCours(false);
    if (error) { setMessage("Impossible de désactiver : " + error.message); return; }
    setMessage("Double authentification désactivée.");
    relire();
  };

  const titre = { fontSize: 14.5, display: "flex", alignItems: "center", gap: 8 };
  const aide = { fontSize: 12.5, color: "var(--brume)", lineHeight: 1.5 };

  return (
    <div className="bloc-notif" style={{ marginTop: 16 }}>
      <b style={titre}>
        {facteur
          ? <ShieldCheck size={17} strokeWidth={1.9} aria-hidden style={{ color: "#9FD8B4" }} />
          : <ShieldAlert size={17} strokeWidth={1.9} aria-hidden style={{ color: "var(--or-clair)" }} />}
        Double authentification
      </b>

      {facteur === undefined && <p style={aide}>Lecture…</p>}

      {facteur === null && !enrolement && (
        <>
          <p style={aide}>
            Ton compte a des pouvoirs sur le réseau : valider, suspendre, voir l&apos;annuaire
            entier. Un mot de passe volé suffirait. Avec la double authentification, la
            connexion demande en plus un code à six chiffres, généré par une appli sur ton
            téléphone et valable trente secondes.
          </p>
          <button className="btn btn-notif" onClick={commencer} disabled={enCours}
            style={{ width: "auto", justifySelf: "start", padding: "9px 14px", fontSize: 12.5 }}>
            {enCours ? "Préparation…" : "Activer"}
          </button>
        </>
      )}

      {enrolement && (
        <>
          <p style={aide}>
            <b style={{ color: "var(--craie)" }}>1.</b>{" "}Installe une appli d&apos;authentification
            si tu n&apos;en as pas (Google Authenticator, Microsoft Authenticator, Aegis…).
          </p>
          <p style={aide}>
            <b style={{ color: "var(--craie)" }}>2.</b>{" "}Ajoute ce compte. Depuis ce téléphone,
            le plus simple est ce lien — il ouvre l&apos;appli directement :
          </p>
          <a className="btn btn-nu" href={enrolement.uri}
            style={{ width: "auto", justifySelf: "start", padding: "9px 14px", fontSize: 12.5 }}>
            Ouvrir mon appli d&apos;authentification
          </a>
          <p style={aide}>
            Sinon, recopie cette clé à la main :<br />
            <code style={{
              display: "block", marginTop: 6, padding: "8px 10px", background: "var(--encre)",
              border: "1px solid var(--ligne)", borderRadius: 10, fontSize: 12.5,
              letterSpacing: 1, overflowWrap: "anywhere", color: "var(--craie-2)",
            }}>{enrolement.secret}</code>
          </p>
          {enrolement.qr && (
            <details>
              <summary style={{ ...aide, cursor: "pointer" }}>
                Afficher le QR code (pour scanner depuis un autre appareil)
              </summary>
              <div style={{ background: "#fff", padding: 10, borderRadius: 12, marginTop: 8, width: "fit-content" }}>
                {enrolement.qr.startsWith("<svg")
                  ? <span dangerouslySetInnerHTML={{ __html: enrolement.qr }} />
                  : <img src={enrolement.qr} alt="QR code à scanner" style={{ display: "block", width: 168, height: 168 }} />}
              </div>
            </details>
          )}
          <p style={aide}>
            <b style={{ color: "var(--craie)" }}>3.</b>{" "}Saisis le code affiché par l&apos;appli :
          </p>
          <input className="saisie" inputMode="numeric" autoComplete="one-time-code"
            placeholder="123456" maxLength={6} value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            aria-label="Code à six chiffres" style={{ letterSpacing: 4, textAlign: "center" }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-or" style={{ flex: 1 }} onClick={confirmer}
              disabled={enCours || code.length < 6}>
              {enCours ? "Vérification…" : "Confirmer"}
            </button>
            <button className="btn btn-nu" onClick={() => { setEnrolement(null); setCode(""); }} disabled={enCours}>
              Annuler
            </button>
          </div>
        </>
      )}

      {facteur && (
        <>
          <p style={aide}>
            Activée. À chaque connexion, le site te demandera le code de ton appli.
            <br /><b style={{ color: "var(--or-clair)" }}>Garde ton téléphone accessible :</b> sans
            lui, il faudra qu&apos;un autre administrateur t&apos;aide à rouvrir ton compte.
          </p>
          <button className="btn btn-nu" onClick={desactiver} disabled={enCours}
            style={{ width: "auto", justifySelf: "start", padding: "9px 14px", fontSize: 12.5 }}>
            Désactiver
          </button>
        </>
      )}

      {message && (
        <p role="alert" style={{ ...aide, color: message.includes("✓") ? "#9FD8B4" : "var(--or-clair)" }}>
          {message}
        </p>
      )}
    </div>
  );
}
