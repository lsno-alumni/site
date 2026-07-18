"use client";

import { useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import { creerClientNavigateur } from "@/lib/supabase/client";

// Gestion d'un membre par un ADMIN : identité, email, mot de passe
// temporaire, suspension, co-admin, suppression. Les contacts privés
// restent invisibles — même pour un admin (promesse de confidentialité).
const STATUTS = { valide: "validé", en_attente: "en attente", suspendu: "suspendu" };

export default function GestionMembre({ moiId, signale }) {
  const supabase = creerClientNavigateur();
  const [q, setQ] = useState("");
  const [tous, setTous] = useState([]);
  const [promos, setPromos] = useState([]);
  const [choisi, setChoisi] = useState(null); // fiche en cours de gestion
  const [email, setEmail] = useState(null);
  const [confirme, setConfirme] = useState(null); // email confirmé ?
  const [form, setForm] = useState({});
  const [mdp, setMdp] = useState("");
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, prenom, nom, photo_url, statut_compte, role, promotion_id, promotions(numero)")
        .order("prenom");
      setTous(data ?? []);
      const { data: p } = await supabase.from("promotions").select("id, numero").order("numero");
      setPromos(p ?? []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resultats = q.trim()
    ? tous.filter((m) => `${m.prenom} ${m.nom}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6)
    : [];

  const ouvrir = async (m) => {
    setChoisi(m);
    setForm({ prenom: m.prenom, nom: m.nom, promotion_id: m.promotion_id });
    setMdp("");
    setEmail("…");
    const { data, error } = await supabase.rpc("admin_email_de", { cible: m.id });
    setEmail(error ? "(indisponible)" : data);
    setConfirme(null);
  };

  const action = async (fn, succes) => {
    setEnCours(true);
    try {
      await fn();
      signale(succes);
    } catch (e) {
      signale("Refusé : " + (e.message ?? e));
    }
    setEnCours(false);
  };

  const enregistrer = () => action(async () => {
    const { error } = await supabase.from("profiles").update(form).eq("id", choisi.id);
    if (error) throw error;
    setTous((l) => l.map((x) => (x.id === choisi.id ? { ...x, ...form, promotions: { numero: promos.find((p) => p.id === form.promotion_id)?.numero } } : x)));
    setChoisi((c) => ({ ...c, ...form }));
  }, "Identité enregistrée ✓");

  const renvoyerConfirmation = () => action(async () => {
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) throw error;
  }, "Email de confirmation renvoyé ✓");

  const confirmerEmail = () => action(async () => {
    const { error } = await supabase.rpc("admin_confirme_email", { cible: choisi.id });
    if (error) throw error;
    setConfirme(true);
  }, "Email confirmé à la main ✓");

  const emailReinit = () => action(async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/mot-de-passe/nouveau`,
    });
    if (error) throw error;
  }, "Email de réinitialisation envoyé ✓");

  const mdpTemporaire = () => action(async () => {
    const { error } = await supabase.rpc("admin_mdp_temporaire", { cible: choisi.id, nouveau: mdp });
    if (error) throw error;
    setMdp("");
  }, "Mot de passe temporaire défini ✓ — communique-le au membre");

  const suspendre = (suspendu) => action(async () => {
    const { error } = await supabase
      .from("profiles").update({ statut_compte: suspendu ? "suspendu" : "valide" }).eq("id", choisi.id);
    if (error) throw error;
    setChoisi((c) => ({ ...c, statut_compte: suspendu ? "suspendu" : "valide" }));
    setTous((l) => l.map((x) => (x.id === choisi.id ? { ...x, statut_compte: suspendu ? "suspendu" : "valide" } : x)));
  }, suspendu ? "Compte suspendu" : "Compte réactivé ✓");

  const nommerAdmin = () => {
    const attendu = `${choisi.prenom} ${choisi.nom}`;
    const saisie = prompt(
      `Nommer ${attendu} CO-ADMINISTRATEUR ? Il pourra tout gérer, partout, définitivement.\n\nPour confirmer, recopie son nom complet :`
    );
    if (saisie === null) return;
    if (saisie.trim() !== attendu) { signale("Nom non conforme — action annulée."); return; }
    action(async () => {
      const { error } = await supabase.from("profiles").update({ role: "admin" }).eq("id", choisi.id);
      if (error) throw error;
      setChoisi((c) => ({ ...c, role: "admin" }));
    }, `${attendu} est maintenant administrateur ✓`);
  };

  const supprimer = () => {
    const attendu = `${choisi.prenom} ${choisi.nom}`;
    const saisie = prompt(
      `SUPPRIMER DÉFINITIVEMENT le compte de ${attendu} ?\nProfil, parcours, photo, connexion : tout sera effacé, sans retour.\n\nPour confirmer, recopie son nom complet :`
    );
    if (saisie === null) return;
    if (saisie.trim() !== attendu) { signale("Nom non conforme — action annulée."); return; }
    action(async () => {
      if (choisi.photo_url) await supabase.storage.from("photos").remove([`${choisi.id}.jpg`]);
      const { error } = await supabase.rpc("admin_supprime_compte", { cible: choisi.id });
      if (error) throw error;
      setTous((l) => l.filter((x) => x.id !== choisi.id));
      setChoisi(null);
    }, "Compte supprimé.");
  };

  const btn = { padding: "9px 13px", fontSize: 12 };

  return (
    <>
      <h2 className="a-titre" style={{ marginTop: 22 }}>Gérer un membre</h2>
      <p style={{ fontSize: 12.5, color: "var(--brume)", marginTop: -6 }}>
        Corriger une identité, débloquer un compte, suspendre, supprimer.
      </p>
      <input className="saisie" placeholder="Chercher un membre à gérer…" value={q}
        onChange={(e) => { setQ(e.target.value); setChoisi(null); }} aria-label="Chercher un membre à gérer" />

      {!choisi && resultats.map((m) => (
        <button key={m.id} className="e-ligne" style={{ width: "100%", textAlign: "left", cursor: "pointer", background: "var(--carte)", border: "1px solid var(--ligne)" }}
          onClick={() => ouvrir(m)}>
          <Avatar profil={{ prenom: m.prenom, nom: m.nom, photo: m.photo_url }} className="init" />
          <span className="val">
            <b style={{ fontSize: 13.5 }}>{m.prenom} {m.nom}</b>
            <span style={{ color: "var(--brume)", fontSize: 12 }}>
              {" "}· P{m.promotions?.numero} · {STATUTS[m.statut_compte]}{m.role !== "membre" ? ` · ${m.role}` : ""}
            </span>
          </span>
        </button>
      ))}

      {choisi && (
        <div className="carte-sombre" style={{ padding: 16, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar profil={{ prenom: choisi.prenom, nom: choisi.nom, photo: choisi.photo_url }} className="init" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>{choisi.prenom} {choisi.nom}</b>
              <div style={{ fontSize: 12, color: "var(--brume)" }}>
                {STATUTS[choisi.statut_compte]}{choisi.role !== "membre" ? ` · ${choisi.role}` : ""}
              </div>
            </div>
            <button className="btn btn-nu" style={btn} onClick={() => setChoisi(null)}>Fermer</button>
          </div>

          <div style={{ fontSize: 12.5, color: "var(--craie-2)", wordBreak: "break-all" }}>
            <span style={{ color: "var(--brume)" }}>Email de connexion : </span><b>{email}</b>
            {confirme && <span style={{ color: "#9FD8B4" }}> · confirmé ✓</span>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input className="saisie" style={{ padding: "10px 12px", fontSize: 13 }} aria-label="Prénom"
              value={form.prenom ?? ""} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
            <input className="saisie" style={{ padding: "10px 12px", fontSize: 13 }} aria-label="Nom"
              value={form.nom ?? ""} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <select className="saisie" style={{ flex: 1, padding: "10px 12px", fontSize: 13 }} aria-label="Promotion"
              value={form.promotion_id ?? ""} onChange={(e) => setForm({ ...form, promotion_id: Number(e.target.value) })}>
              {promos.map((p) => <option key={p.id} value={p.id}>Promotion {p.numero}</option>)}
            </select>
            <button className="btn btn-or" style={btn} onClick={enregistrer} disabled={enCours}>Enregistrer</button>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-nu" style={btn} onClick={renvoyerConfirmation} disabled={enCours}>Renvoyer l&apos;email de confirmation</button>
            <button className="btn btn-nu" style={btn} onClick={confirmerEmail} disabled={enCours}>Confirmer l&apos;email à la main</button>
            <button className="btn btn-nu" style={btn} onClick={emailReinit} disabled={enCours}>Email de réinit. mot de passe</button>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <input className="saisie" style={{ flex: 1, padding: "10px 12px", fontSize: 13 }} type="text"
              placeholder="Mot de passe temporaire (8 car. min)" value={mdp} onChange={(e) => setMdp(e.target.value)}
              aria-label="Mot de passe temporaire" />
            <button className="btn btn-nu" style={btn} onClick={mdpTemporaire} disabled={enCours || mdp.length < 8}>
              Définir
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid var(--ligne)", paddingTop: 12 }}>
            {choisi.statut_compte === "suspendu" ? (
              <button className="btn btn-or" style={btn} onClick={() => suspendre(false)} disabled={enCours}>Réactiver le compte</button>
            ) : (
              <button className="btn btn-nu" style={btn} onClick={() => suspendre(true)} disabled={enCours}>Suspendre le compte</button>
            )}
            {choisi.role !== "admin" && choisi.id !== moiId && (
              <>
                <button className="btn btn-nu" style={btn} onClick={nommerAdmin} disabled={enCours}>Nommer co-admin</button>
                <button className="btn btn-nu" style={{ ...btn, color: "var(--rouge)" }} onClick={supprimer} disabled={enCours}>
                  Supprimer le compte
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
