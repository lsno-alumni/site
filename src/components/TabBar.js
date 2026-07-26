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

// Cache au niveau MODULE : survit aux navigations client (contrairement à
// l'état React qui se réinitialise à chaque remontage de la TabBar) → dès la
// 2e page, le rôle est connu au 1er rendu = plus aucun clignotement 4→5.
// Écrit UNIQUEMENT dans le useEffect (côté client) → jamais côté serveur
// (pas de fuite entre utilisateurs, pas de décalage d'hydratation).
let roleCache = null;

export default function TabBar({ actif }) {
  const [role, setRole] = useState(roleCache);

  useEffect(() => {
    if (role) return; // rôle déjà connu (cache module) : rien à faire
    let vivant = true;
    // secours immédiat depuis la session (rechargement dur) avant le réseau
    const cache = sessionStorage.getItem("lsno_role");
    if (cache) { roleCache = cache; setRole(cache); }
    (async () => {
      const supabase = creerClientNavigateur();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (!vivant) return;
      const r = data?.role ?? null;
      roleCache = r;
      setRole(r);
      if (r) sessionStorage.setItem("lsno_role", r);
    })();
    return () => { vivant = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
