"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ArrowRight } from "lucide-react";
import { exigerProfilComplet } from "@/lib/profilComplet";

// Sur le profil d'un autre membre : ses coordonnées restent dans la base tant que
// MON profil n'a pas le minimum (contacts_de renvoie {verrou:"profil_incomplet"},
// migration 84). Un tap ouvre la feuille « Dis-leur qui tu es », puis la page se
// recharge avec les coordonnées.
export default function VerrouContacts({ prenom }) {
  const routeur = useRouter();
  const [enCours, setEnCours] = useState(false);
  const ouvrir = async () => {
    setEnCours(true);
    try { await exigerProfilComplet(); routeur.refresh(); } catch { /* plus tard */ }
    finally { setEnCours(false); }
  };
  return (
    <section className="p-contacts p-verrou">
      <h4 style={{ fontSize: 11, letterSpacing: ".3em", textTransform: "uppercase", color: "var(--bleu-texte)", marginBottom: 6 }}>Contact</h4>
      <p className="p-verrou-texte"><Lock size={14} aria-hidden /> Les coordonnées de {prenom} s’ouvrent quand ton propre profil est complet : photo, ville, pays et une ligne sur toi. Donnant-donnant.</p>
      <button type="button" className="btn btn-or" onClick={ouvrir} disabled={enCours} style={{ display: "inline-flex" }}>
        Compléter mon profil <ArrowRight size={15} aria-hidden />
      </button>
    </section>
  );
}
