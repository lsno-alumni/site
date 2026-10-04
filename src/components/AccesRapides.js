"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Info, ShieldCheck } from "lucide-react";
import { creerClientNavigateur } from "@/lib/supabase/client";

// En haut du Fil : deux accès qui n'ont pas d'onglet — « À propos » pour
// tous, « Validation » (avec le nombre de demandes en attente) pour les
// délégués et administrateurs. Ils étaient enfouis dans Mon profil.
export default function AccesRapides({ moderateur = false }) {
  const [attente, setAttente] = useState(null);
  useEffect(() => {
    if (!moderateur) return;
    let vivant = true;
    const lire = () => creerClientNavigateur().from("profiles").select("id", { count: "exact", head: true }).eq("statut_compte", "en_attente")
      .then(({ count }) => { if (vivant) setAttente(count ?? 0); }).catch(() => {});
    const t = setTimeout(lire, 0);
    window.addEventListener("lsno:rafraichir", lire);
    return () => { vivant = false; clearTimeout(t); window.removeEventListener("lsno:rafraichir", lire); };
  }, [moderateur]);
  return (
    <div className="acces-rapides">
      <Link href="/a-propos" className="acces-rapide" aria-label="À propos du réseau" title="À propos du réseau"><Info size={18} strokeWidth={1.9} aria-hidden /></Link>
      {moderateur && (
        <Link href="/admin" className={`acces-rapide${attente ? " urgent" : ""}`} aria-label={`Validation${attente ? `, ${attente} demande${attente > 1 ? "s" : ""} en attente` : ""}`} title="Validation des inscriptions">
          <ShieldCheck size={18} strokeWidth={1.9} aria-hidden />
          {attente > 0 && <span className="tab-pastille acces-pastille">{attente > 99 ? "99+" : attente}</span>}
        </Link>
      )}
    </div>
  );
}
