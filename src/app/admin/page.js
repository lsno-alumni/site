"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as memoire from "@/lib/memoire";
import TabBar from "@/components/TabBar";
import Avatar from "@/components/Avatar";
import { Lock, ChevronDown } from "lucide-react";
import { SqueletteEnTeteListe, SqueletteFiche } from "@/components/Squelettes";
import GlisserRafraichir from "@/components/GlisserRafraichir";
import Surligne, { plat } from "@/components/Surligne";
import { creerClientNavigateur } from "@/lib/supabase/client";
import GestionMembre from "./GestionMembre";
import Sauvegarde from "./Sauvegarde";
import Journal from "./Journal";
import Annonce from "./Annonce";
import EtatSysteme from "./EtatSysteme";
import MenuAdmin from "./MenuAdmin";

// Espace délégué / admin : validation des inscriptions, avec annulation.
// La RLS limite un délégué à sa promotion ; un admin voit tout.
export default function Validation() {
  const supabase = creerClientNavigateur();
  const routeur = useRouter();
  // mémoire d'onglet (src/lib/memoire.js) : affichage immédiat, rechargement derrière
  const [moi, setMoi] = useState(() => memoire.lire("admin.moi") ?? null);
  const [demandes, setDemandes] = useState(() => memoire.lire("admin.demandes") ?? []);
  const [membres, setMembres] = useState(() => memoire.lire("admin.membres") ?? []);
  const [rechercheRole, setRechercheRole] = useState("");
  const [promoRole, setPromoRole] = useState("");   // filtre promotion des rôles
  const [triPromo, setTriPromo] = useState(false);  // classer par promotion
  const [stats, setStats] = useState(() => memoire.lire("admin.stats") ?? { valides: 0, promo: null });
  const [snack, setSnack] = useState(null); // { demande, valide } ou { info }
  const minuteur = useRef(null);

  const charger = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profil } = await supabase
      .from("profiles").select("id, role, promotion_id, promotions(numero)").eq("id", user.id).maybeSingle();
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
    // le délégué voit aussi le compte de SA promotion
    let promo = null;
    if (profil.role === "delegue") {
      const { count: n } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("statut_compte", "valide")
        .eq("promotion_id", profil.promotion_id);
      promo = n ?? 0;
    }
    setStats({ valides: count ?? 0, promo });

    if (profil.role === "admin") {
      const { data: valides } = await supabase
        .from("profiles")
        .select("id, prenom, nom, role, promotions(numero)")
        .eq("statut_compte", "valide")
        .order("prenom");
      setMembres(valides ?? []);
    }
  };

  // charger() dépend du rôle du membre connu seulement après une 1re requête
  // (délégué → + son propre compte) : la séquence appartient à l'effet.
  useEffect(() => { charger(); }, []); // eslint-disable-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { memoire.ecrire("admin.moi", moi); }, [moi]);
  useEffect(() => { memoire.ecrire("admin.demandes", demandes); }, [demandes]);
  useEffect(() => { memoire.ecrire("admin.membres", membres); }, [membres]);
  useEffect(() => { memoire.ecrire("admin.stats", stats); }, [stats]);

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
    routeur.refresh();   // l'annuaire et l'accueil sont en cache 30 s : un membre validé doit y apparaître tout de suite
    if (valide) setStats((s) => ({ valides: s.valides + 1 }));
    setSnack({ demande: d, valide });
    clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => setSnack(null), 4200);
  };

  // promotions présentes parmi les membres validés (pour le filtre des rôles)
  const promosMembres = [...new Set(membres.map((m) => m.promotions?.numero).filter(Boolean))]
    .sort((a, b) => a - b);

  const membresFiltres = membres
    .filter((m) => plat(`${m.prenom} ${m.nom}`).includes(plat(rechercheRole.trim())))
    .filter((m) => !promoRole || String(m.promotions?.numero) === promoRole)
    .sort((a, b) =>
      triPromo
        // par promotion croissante, puis alphabétique à l'intérieur
        ? (a.promotions?.numero ?? 99) - (b.promotions?.numero ?? 99) ||
          a.prenom.localeCompare(b.prenom, "fr")
        : 0 // ordre de la requête (alphabétique)
    );

  const changerRole = async (m, role) => {
    const { error } = await supabase.from("profiles").update({ role }).eq("id", m.id);
    if (error) {
      setSnack({ erreur: "Refusé : " + error.message });
    } else {
      setMembres((l) => l.map((x) => (x.id === m.id ? { ...x, role } : x)));
      routeur.refresh();
      setSnack({ info: `${m.prenom} ${m.nom} → ${role === "delegue" ? "délégué·e ✓" : "membre"}` });
    }
    clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => setSnack(null), 3500);
  };

  const annuler = async () => {
    const { demande, valide } = snack;
    await supabase.from("profiles").update({ statut_compte: "en_attente" }).eq("id", demande.id);
    setDemandes((l) => [...l, demande]);
    routeur.refresh();
    if (valide) setStats((s) => ({ valides: s.valides - 1 }));
    setSnack(null);
  };

  if (moi === null) {
    return (
      <main className="page avec-tabbar">
        <SqueletteEnTeteListe avecRecherche={false} />
        <div className="n-liste" style={{ paddingTop: 16 }}>
          {[0, 1].map((i) => <SqueletteFiche key={i} />)}
        </div>
        <TabBar actif="Validation" />
      </main>
    );
  }

  if (moi && moi.role === "membre") {
    return (
      <main className="page avec-tabbar">
        <div className="vide" style={{ paddingTop: 100 }}>
          <div className="gros" aria-hidden><Lock size={30} strokeWidth={1.6} /></div>
          <b>Espace réservé</b>{" "}
          Cette page est réservée aux délégués de promotion et aux administrateurs.
        </div>
        <TabBar actif="Validation" />
      </main>
    );
  }

  return (
    <GlisserRafraichir onRafraichir={charger}>
    <main className="page avec-tabbar">
      <header className="n-tete tete-eleves ad-tete" id="sec-demandes">
        <p className="tagline">
          {moi?.role === "admin" ? "Espace admin · toutes promotions" : `Espace délégué · Promo ${moi?.promotions?.numero ?? "…"}`}
        </p>
        <h1 style={{ marginTop: 8 }}>Demandes<br />d&apos;inscription</h1>
        <p className="cpt">
          {demandes.length > 0 ? `${demandes.length} en attente` : "Tout est à jour ✓"}
        </p>
      </header>
      {moi?.role === "admin" && <MenuAdmin />}

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

        <h2 className="a-titre ad-chapitre" id="sec-reseau" style={{ marginTop: 18 }}>Le réseau</h2>
        {/* les chiffres de l'espace, sur le bleu nuit de l'accueil */}
        <div className="a-stats ad-stats">
          <div className="a-stat"><b>{stats.valides}</b><span>validés</span></div>
          {stats.promo !== null
            ? <div className="a-stat"><b>{stats.promo}</b><span>promo {moi?.promotions?.numero}</span></div>
            : <div className="a-stat"><b>{membres.filter((m) => m.role === "delegue").length}</b><span>délégués</span></div>}
          <div className="a-stat"><b>{demandes.length}</b><span>en attente</span></div>
        </div>

        {moi?.role === "admin" && (
          <>
            {/* repliée par défaut : ouvrir l'onglet affichait sinon la liste des
                ~200 membres en entier avant même d'avoir cherché quoi que ce
                soit — repliable comme les grandes sections de Mon profil */}
            <details className="grande-partie" id="sec-roles" style={{ marginTop: 18, scrollMarginTop: 12 }}>
              <summary className="a-titre ad-chapitre" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                Rôles
                <span style={{ fontSize: 13, fontWeight: 400, color: "var(--brume)" }}>
                  ({membres.length} membre{membres.length > 1 ? "s" : ""})
                </span>
                <ChevronDown size={18} className="chevron" aria-hidden style={{ marginLeft: "auto" }} />
              </summary>
              <div style={{ marginTop: 10 }}>
                <p style={{ fontSize: 12.5, color: "var(--brume)", marginTop: -6, marginBottom: 12 }}>
                  Un délégué valide les inscriptions de sa promotion.
                </p>
                <input
                  className="saisie"
                  placeholder="Chercher un membre…"
                  value={rechercheRole}
                  onChange={(e) => setRechercheRole(e.target.value)}
                  aria-label="Chercher un membre"
                />
                {/* filtrer par promotion et/ou regrouper la liste par promotion */}
                <div className="n-filtres libre">
                  <select className="puce" value={promoRole} onChange={(e) => setPromoRole(e.target.value)}
                    aria-label="Filtrer les rôles par promotion">
                    <option value="">Promo — toutes</option>
                    {promosMembres.map((n) => <option key={n} value={String(n)}>Promo {n}</option>)}
                  </select>
                  <button className={`puce${triPromo ? " active" : ""}`} onClick={() => setTriPromo(!triPromo)}
                    aria-pressed={triPromo}>
                    Classer par promotion
                  </button>
                  <span className="puce" style={{ borderStyle: "dashed", cursor: "default" }}>
                    {membresFiltres.length} membre{membresFiltres.length > 1 ? "s" : ""}
                  </span>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                {membresFiltres.map((m) => (
                  <div key={m.id} className="e-ligne">
                    <span className="val">
                      <b style={{ fontSize: 13.5 }}><Surligne texte={`${m.prenom} ${m.nom}`} terme={rechercheRole} /></b>
                      <span style={{ color: "var(--brume)", fontSize: 12 }}>
                        {" "}· Promo {m.promotions?.numero}
                        {m.role === "admin" && " · admin"}
                        {m.role === "delegue" && " · délégué·e"}
                      </span>
                    </span>
                    {m.role === "admin" ? (
                      <span style={{ fontSize: 11, color: "var(--bleu-texte)" }}>—</span>
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
                </div>
              </div>
            </details>

            <div id="sec-gerer" className="sec-admin" style={{ scrollMarginTop: 12 }}>
              <GestionMembre moiId={moi.id} signale={(m) => {
                setSnack({ info: m });
                clearTimeout(minuteur.current);
                minuteur.current = setTimeout(() => setSnack(null), 4200);
              }} />
            </div>
            <div id="sec-annonce" className="sec-admin" style={{ scrollMarginTop: 12 }}>
              <Annonce signale={(m) => {
                setSnack({ info: m });
                clearTimeout(minuteur.current);
                minuteur.current = setTimeout(() => setSnack(null), 4200);
              }} />
            </div>
            <div id="sec-journal" className="sec-admin" style={{ scrollMarginTop: 12 }}>
              <Journal />
            </div>
            <div id="sec-sauvegarde" className="sec-admin" style={{ scrollMarginTop: 12 }}>
              <Sauvegarde signale={(m) => {
                setSnack({ info: m });
                clearTimeout(minuteur.current);
                minuteur.current = setTimeout(() => setSnack(null), 4200);
              }} />
            </div>
            <div id="sec-etat" className="sec-admin" style={{ scrollMarginTop: 12 }}>
              <EtatSysteme />
            </div>
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
    </GlisserRafraichir>
  );
}
