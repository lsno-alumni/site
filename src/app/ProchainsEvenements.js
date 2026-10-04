"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import * as memoire from "@/lib/memoire";
import { listeEvenements } from "@/lib/evenements";
import { CarteEvenement } from "@/app/evenements/Evenements";

// Sur l'accueil connecté : les trois prochains événements, et le lien vers
// la liste. Rien si rien n'est prévu.
export default function ProchainsEvenements() {
  const [liste, setListe] = useState(() => memoire.lire("evenements.a_venir") ?? null);
  useEffect(() => {
    let vivant = true;
    const t = setTimeout(() => listeEvenements({ quand: "a_venir", limite: 3 }).then((l) => { if (vivant) setListe(l); }).catch(() => {}), 0);
    return () => { vivant = false; clearTimeout(t); };
  }, []);
  const trois = (liste ?? []).filter((e) => !e.annule).slice(0, 3);
  if (!trois.length) return null;
  return (
    <section className="a-section">
      <h2 className="a-titre" style={{ marginBottom: 6 }}>Prochains événements</h2>
      <p className="am-sous-titre">Dis si tu viens : ça aide celui qui organise.</p>
      <div className="am-offres">
        {trois.map((e) => <CarteEvenement key={e.id} e={e} compacte />)}
      </div>
      <Link href="/evenements" className="am-tout">Tous les événements <ArrowRight size={14} aria-hidden /></Link>
    </section>
  );
}
