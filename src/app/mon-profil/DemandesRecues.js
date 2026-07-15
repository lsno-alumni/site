"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import Avatar from "@/components/Avatar";
import { creerClientNavigateur } from "@/lib/supabase/client";

// Demandes de mise en relation reçues (en attente). Accepter ouvre mes
// contacts « sur demande » au demandeur ; refuser reste silencieux pour lui.
export default function DemandesRecues({ signale }) {
  const supabase = creerClientNavigateur();
  const [demandes, setDemandes] = useState([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("demandes_contact")
        .select("id, message, demandeur:profiles!demandes_contact_demandeur_fkey(id, prenom, nom, photo_url, promotions(numero))")
        .eq("cible", user.id)
        .eq("statut", "attente")
        .order("cree_le");
      setDemandes(data ?? []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const traiter = async (d, accepte) => {
    const { error } = await supabase
      .from("demandes_contact")
      .update({ statut: accepte ? "acceptee" : "refusee" })
      .eq("id", d.id);
    if (error) {
      signale("Échec : " + error.message);
      return;
    }
    setDemandes((l) => l.filter((x) => x.id !== d.id));
    signale(accepte
      ? `Contacts ouverts à ${d.demandeur.prenom} ✓`
      : "Demande refusée (il n'en sera pas informé)");
  };

  if (demandes.length === 0) return null;

  return (
    <div className="champ">
      <label>Demandes de contact reçues</label>
      <div className="e-visi">
        {demandes.map((d) => (
          <div key={d.id} className="carte-sombre" style={{ padding: 14, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 11, alignItems: "center" }}>
              <Avatar
                profil={{ prenom: d.demandeur.prenom, nom: d.demandeur.nom, photo: d.demandeur.photo_url }}
                className="init"
              />
              <div>
                <b style={{ fontSize: 14 }}>{d.demandeur.prenom} {d.demandeur.nom}</b>
                <div style={{ fontSize: 12, color: "var(--brume)" }}>
                  Promo {d.demandeur.promotions?.numero} · souhaite tes contacts « sur demande »
                </div>
              </div>
            </div>
            {d.message && (
              <p style={{ fontSize: 13, fontStyle: "italic", color: "var(--craie-2)", lineHeight: 1.5 }}>
                « {d.message} »
              </p>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-or" style={{ flex: 1, padding: 11 }} onClick={() => traiter(d, true)}>
                <Check size={14} aria-hidden /> Accepter
              </button>
              <button className="btn btn-nu" style={{ padding: "11px 16px" }} onClick={() => traiter(d, false)}>
                <X size={14} aria-hidden /> Refuser
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
