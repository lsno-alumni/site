"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Users, Megaphone, Info, CircleUser, ShieldCheck } from "lucide-react";
import { creerClientNavigateur } from "@/lib/supabase/client";

// 4 onglets pour tout le monde ; « Validation » ajouté seulement pour les
// délégués et admins (les membres n'y ont pas accès — la page affiche
// « espace réservé » de toute façon).
const ONGLETS = [
  { href: "/annuaire", Icone: Users, nom: "Annuaire" },
  { href: "/offres", Icone: Megaphone, nom: "Offres" },
  { href: "/a-propos", Icone: Info, nom: "À propos" },
  { href: "/mon-profil", Icone: CircleUser, nom: "Mon profil" },
];
const VALIDATION = { href: "/admin", Icone: ShieldCheck, nom: "Validation" };

export default function TabBar({ actif }) {
  // null tant qu'inconnu (rendu serveur = 4 onglets, pas de décalage d'hydratation)
  const [role, setRole] = useState(null);

  useEffect(() => {
    let vivant = true;
    // affichage immédiat depuis le cache de session (évite le clignotement 4→5)
    const cache = sessionStorage.getItem("lsno_role");
    if (cache) setRole(cache);
    (async () => {
      const supabase = creerClientNavigateur();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (!vivant) return;
      const r = data?.role ?? null;
      setRole(r);
      if (r) sessionStorage.setItem("lsno_role", r);
    })();
    return () => { vivant = false; };
  }, []);

  const onglets = role && role !== "membre" ? [...ONGLETS, VALIDATION] : ONGLETS;

  return (
    <nav className="tabbar" aria-label="Navigation principale">
      {onglets.map((o) => (
        <Link key={o.href} href={o.href} className={`tab${actif === o.nom ? " on" : ""}`}>
          <o.Icone size={19} strokeWidth={1.8} aria-hidden />
          {o.nom}
        </Link>
      ))}
    </nav>
  );
}
