"use client";

import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { creerClientNavigateur } from "@/lib/supabase/client";

// Annonce email à tous les membres validés — envoi ÉTALÉ par la base :
// 150 emails/jour max (moitié du quota Brevo), le reste part tout seul
// les jours suivants à 11h. Une seule annonce en cours à la fois.
export default function Annonce({ signale }) {
  const supabase = creerClientNavigateur();
  const [sujet, setSujet] = useState("");
  const [corps, setCorps] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [suivi, setSuivi] = useState(null); // { sujet, envoyes, total, terminee }

  const chargerSuivi = async () => {
    const { data: a } = await supabase
      .from("annonces").select("id, sujet, terminee")
      .order("cree_le", { ascending: false }).limit(1).maybeSingle();
    if (!a) return setSuivi(null);
    const { count: envoyes } = await supabase
      .from("annonce_envois").select("annonce_id", { count: "exact", head: true })
      .eq("annonce_id", a.id);
    const { count: total } = await supabase
      .from("profiles").select("id", { count: "exact", head: true })
      .eq("statut_compte", "valide");
    setSuivi({ sujet: a.sujet, terminee: a.terminee, envoyes: envoyes ?? 0, total: total ?? 0 });
  };
  useEffect(() => { chargerSuivi(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const publier = async () => {
    if (!sujet.trim() || !corps.trim()) { signale("Sujet et message obligatoires."); return; }
    if (!confirm(
      `Envoyer cette annonce par EMAIL à tous les membres validés ?\n\n« ${sujet.trim()} »\n\n` +
      "Jusqu'à 150 partent maintenant, le reste s'étale automatiquement (11h chaque jour)."
    )) return;
    setEnCours(true);
    const { error } = await supabase.rpc("admin_publie_annonce", { p_sujet: sujet.trim(), p_corps: corps.trim() });
    setEnCours(false);
    if (error) { signale("Refusé : " + error.message); return; }
    setSujet(""); setCorps("");
    signale("Annonce lancée ✓ — première salve envoyée");
    chargerSuivi();
  };

  return (
    <>
      <h2 className="a-titre" style={{ marginTop: 22 }}>Annonce aux membres</h2>
      <p style={{ fontSize: 12.5, color: "var(--brume)", marginTop: -6 }}>
        Un email à tout le réseau — à réserver aux grandes occasions. L&apos;envoi
        s&apos;étale tout seul pour respecter le quota (150/jour).
      </p>

      {suivi && !suivi.terminee && (
        <div className="carte-sombre" style={{ padding: "12px 14px", fontSize: 12.5, color: "var(--craie-2)" }}>
          <Megaphone size={13} aria-hidden style={{ verticalAlign: "-2px", color: "var(--or-clair)" }} />{" "}
          En cours : « {suivi.sujet} » — <b>{suivi.envoyes}/{suivi.total}</b> envoyés
          {suivi.envoyes < suivi.total && " · la suite part demain à 11h"}
        </div>
      )}
      {suivi?.terminee && (
        <p style={{ fontSize: 12, color: "var(--brume)" }}>
          Dernière annonce : « {suivi.sujet} » — envoyée à tous ✓
        </p>
      )}

      {(!suivi || suivi.terminee) && (
        <>
          <input className="saisie" maxLength={120} placeholder="Sujet (sobre, sans emoji — délivrabilité)"
            value={sujet} onChange={(e) => setSujet(e.target.value)} aria-label="Sujet de l'annonce" />
          <textarea className="saisie" rows={5} maxLength={2000} placeholder="Le message (les retours à la ligne sont conservés)…"
            value={corps} onChange={(e) => setCorps(e.target.value)} aria-label="Message de l'annonce" />
          <button className="btn btn-or" style={{ padding: "11px 18px", fontSize: 13 }}
            onClick={publier} disabled={enCours}>
            {enCours ? "Lancement…" : "Envoyer à tous les membres"}
          </button>
        </>
      )}
    </>
  );
}
