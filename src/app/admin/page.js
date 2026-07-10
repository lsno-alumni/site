"use client";

import { useEffect, useRef, useState } from "react";
import TabBar from "@/components/TabBar";
import Avatar from "@/components/Avatar";
import { creerClientNavigateur } from "@/lib/supabase/client";

// Espace délégué / admin : validation des inscriptions, avec annulation.
// La RLS limite un délégué à sa promotion ; un admin voit tout.
export default function Validation() {
  const supabase = creerClientNavigateur();
  const [moi, setMoi] = useState(null);
  const [demandes, setDemandes] = useState([]);
  const [membres, setMembres] = useState([]);
  const [rechercheRole, setRechercheRole] = useState("");
  const [stats, setStats] = useState({ valides: 0 });
  const [snack, setSnack] = useState(null); // { demande, valide } ou { info }
  const minuteur = useRef(null);

  const charger = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profil } = await supabase
      .from("profiles").select("id, role, promotions(numero)").eq("id", user.id).maybeSingle();
    setMoi(profil);
    if (!profil || profil.role === "membre") return;

    const { data: attente } = await supabase
      .from("profiles")
      .select("id, prenom, nom, photo_url, promotions(numero, annee_bac)")
      .eq("statut_compte", "en_attente")
      .order("cree_le");
    setDemandes(attente ?? []);

    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("statut_compte", "valide");
    setStats({ valides: count ?? 0 });

    if (profil.role === "admin") {
      const { data: valides } = await supabase
        .from("profiles")
        .select("id, prenom, nom, role, promotions(numero)")
        .eq("statut_compte", "valide")
        .order("prenom");
      setMembres(valides ?? []);
    }
  };

  useEffect(() => { charger(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const traiter = async (d, valide) => {
    const { error } = await supabase
      .from("profiles")
      .update({ statut_compte: valide ? "valide" : "suspendu" })
      .eq("id", d.id);
    if (error) {
      setSnack({ erreur: "Action refusée : " + error.message });
      clearTimeout(minuteur.current);
      minuteur.current = setTimeout(() => setSnack(null), 4200);
      return;
    }
    setDemandes((l) => l.filter((x) => x.id !== d.id));
    if (valide) setStats((s) => ({ valides: s.valides + 1 }));
    setSnack({ demande: d, valide });
    clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => setSnack(null), 4200);
  };

  const membresFiltres = membres.filter((m) =>
    `${m.prenom} ${m.nom}`.toLowerCase().includes(rechercheRole.trim().toLowerCase())
  );

  const changerRole = async (m, role) => {
    const { error } = await supabase.from("profiles").update({ role }).eq("id", m.id);
    if (error) {
      setSnack({ erreur: "Refusé : " + error.message });
    } else {
      setMembres((l) => l.map((x) => (x.id === m.id ? { ...x, role } : x)));
      setSnack({ info: `${m.prenom} ${m.nom} → ${role === "delegue" ? "délégué·e ✓" : "membre"}` });
    }
    clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => setSnack(null), 3500);
  };

  const annuler = async () => {
    const { demande, valide } = snack;
    await supabase.from("profiles").update({ statut_compte: "en_attente" }).eq("id", demande.id);
    setDemandes((l) => [...l, demande]);
    if (valide) setStats((s) => ({ valides: s.valides - 1 }));
    setSnack(null);
  };

  if (moi && moi.role === "membre") {
    return (
      <main className="page avec-tabbar">
        <div className="vide" style={{ paddingTop: 100 }}>
          <div className="gros" aria-hidden>🔒</div>
          <b>Espace réservé</b>
          Cette page est réservée aux délégués de promotion et aux administrateurs.
        </div>
        <TabBar actif="Validation" />
      </main>
    );
  }

  return (
    <main className="page avec-tabbar">
      <header className="n-tete tete-eleves" style={{ paddingBottom: 18 }}>
        <p className="tagline">
          {moi?.role === "admin" ? "Espace admin · toutes promotions" : `Espace délégué · Promo ${moi?.promotions?.numero ?? "…"}`}
        </p>
        <h1 style={{ marginTop: 8 }}>Demandes<br />d&apos;inscription</h1>
        <p className="cpt">
          {demandes.length > 0 ? `${demandes.length} en attente` : "Tout est à jour ✓"}
        </p>
      </header>

      <div className="n-liste">
        {demandes.map((d) => (
          <div key={d.id} className="fiche demande">
            <div className="haut">
              <Avatar profil={{ prenom: d.prenom, nom: d.nom, photo: d.photo_url }} className="init" />
              <div>
                <b>{d.prenom} {d.nom}</b>
                <div className="role">
                  Se déclare Promo {d.promotions?.numero}
                  {d.promotions?.annee_bac ? ` · Bac ${d.promotions.annee_bac}` : ""}
                </div>
              </div>
            </div>
            <div className="pied" style={{ gap: 10 }}>
              <button className="btn btn-or" style={{ flex: 1, padding: 11 }} onClick={() => traiter(d, true)}>
                Valider
              </button>
              <button className="btn btn-nu" style={{ padding: "11px 18px" }} onClick={() => traiter(d, false)}>
                Refuser
              </button>
            </div>
          </div>
        ))}

        <h2 className="a-titre" style={{ marginTop: 18 }}>Le réseau</h2>
        <div className="e-stat" style={{ gridTemplateColumns: "auto 1fr" }}>
          <b>{stats.valides}</b><span>membres validés</span>
        </div>

        {moi?.role === "admin" && (
          <>
            <h2 className="a-titre" style={{ marginTop: 18 }}>Rôles</h2>
            <p style={{ fontSize: 12.5, color: "var(--brume)", marginTop: -6 }}>
              Un délégué valide les inscriptions de sa promotion.
            </p>
            <input
              className="saisie"
              placeholder="⌕ Chercher un membre…"
              value={rechercheRole}
              onChange={(e) => setRechercheRole(e.target.value)}
              aria-label="Chercher un membre"
            />
            {membresFiltres.map((m) => (
              <div key={m.id} className="e-ligne">
                <span className="val">
                  <b style={{ fontSize: 13.5 }}>{m.prenom} {m.nom}</b>
                  <span style={{ color: "var(--brume)", fontSize: 12 }}>
                    {" "}· Promo {m.promotions?.numero}
                    {m.role === "admin" && " · admin"}
                    {m.role === "delegue" && " · délégué·e"}
                  </span>
                </span>
                {m.role === "admin" ? (
                  <span style={{ fontSize: 11, color: "var(--or-clair)" }}>—</span>
                ) : m.role === "delegue" ? (
                  <button className="btn btn-nu" style={{ padding: "8px 14px", fontSize: 12 }}
                    onClick={() => changerRole(m, "membre")}>
                    Retirer délégué
                  </button>
                ) : (
                  <button className="btn btn-or" style={{ padding: "8px 14px", fontSize: 12 }}
                    onClick={() => changerRole(m, "delegue")}>
                    Faire délégué·e
                  </button>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      <div className={`toast${snack ? " la" : ""}`} role="status">
        {snack?.erreur}
        {snack?.info}
        {snack && !snack.erreur && !snack.info && (snack.valide ? "Membre validé ✓" : "Demande refusée")}
        {snack && !snack.erreur && !snack.info && (
          <button onClick={annuler} style={{
            border: "none", background: "none", fontWeight: 800, color: "#8A6A1D",
            marginLeft: 12, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3,
          }}>
            Annuler
          </button>
        )}
      </div>
      <TabBar actif="Validation" />
    </main>
  );
}
