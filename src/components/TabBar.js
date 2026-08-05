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

// Cache/glisse au défilement, comme sur les réseaux sociaux : on descend dans
// la page → elle se range en bas ; on remonte, même légèrement → elle revient.
// Seul un `transform` bouge (jamais de flou/opacité en direct du défilement :
// c'est CE calque qui avait corrompu le rendu GPU sur les Mali — voir le
// commentaire de .tabbar dans globals.css). Toujours visible tout en haut de
// la page, pour ne jamais donner l'impression qu'elle a disparu pour de bon.
const SEUIL_HAUT = 40;      // px : zone où la barre reste toujours visible
// ⚠ Seuils volontairement ASYMÉTRIQUES, et calculés sur une distance CUMULÉE
// (depuis le dernier changement de sens), pas sur la vitesse d'une seule frame.
// Comparer deux frames consécutives revenait à mesurer la VITESSE : un
// défilement LENT ne dépassait jamais le seuil, même après avoir parcouru
// beaucoup de distance, et la barre ne se cachait alors jamais. En cumulant,
// un défilement lent finit par franchir le seuil, exactement comme un
// défilement rapide — seule la distance compte, pas l'allure du geste.
const SEUIL_BAS = 28;       // px cumulés vers le bas : pour SE CACHER
const SEUIL_HAUT_GESTE = 6; // px cumulés vers le haut : pour REVENIR (quasi instantané)

// Classe posée sur <html> (pas seulement sur la barre) : la page réserve elle
// aussi de la place pour la barre (.avec-tabbar), et cette place doit se
// libérer EN MÊME TEMPS que la barre se range, sinon un grand vide apparaît en
// bas des pages une fois la barre cachée. TabBar et la page sont deux
// composants frères (pas parent/enfant) : une classe globale synchronise les
// deux sans les faire dépendre l'un de l'autre.
const CLASSE_CACHEE = "tb-cachee";

function useCacherAuDefilement() {
  const [cachee, setCachee] = useState(false);

  useEffect(() => {
    let dernierY = window.scrollY;
    // ⚠ MÊME piège des deux côtés : comparer une seule frame, c'est mesurer
    // une vitesse. Le seuil de RETOUR avait la même faiblesse que celui de la
    // mise en cache (corrigé avant) — un défilement lent vers le haut ne
    // dépassait jamais 6px d'un coup, donc la barre ne revenait jamais. Les
    // deux sens cumulent maintenant leur propre distance, remise à zéro dès
    // que le sens s'inverse.
    let cumulBas = 0;
    let cumulHaut = 0;
    let planifie = false;

    const evaluer = () => {
      planifie = false;
      const y = window.scrollY;
      const delta = y - dernierY;
      dernierY = y;

      if (y < SEUIL_HAUT) { setCachee(false); cumulBas = 0; cumulHaut = 0; return; }

      if (delta > 0) {
        cumulHaut = 0;
        cumulBas += delta;
        if (cumulBas > SEUIL_BAS) setCachee(true);
      } else if (delta < 0) {
        cumulBas = 0;
        cumulHaut += -delta;
        if (cumulHaut > SEUIL_HAUT_GESTE) setCachee(false);
      }
    };
    const auDefilement = () => {
      if (planifie) return;
      planifie = true;
      requestAnimationFrame(evaluer);
    };
    window.addEventListener("scroll", auDefilement, { passive: true });
    return () => window.removeEventListener("scroll", auDefilement);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle(CLASSE_CACHEE, cachee);
    // à la navigation suivante, la page part toujours du haut (cachee=false) :
    // retirer la classe évite qu'elle reste posée si ce composant disparaît
    // avant que le prochain n'ait eu la main
    return () => document.documentElement.classList.remove(CLASSE_CACHEE);
  }, [cachee]);

  return cachee;
}

export default function TabBar({ actif }) {
  const [role, setRole] = useState(roleCache);
  const cachee = useCacherAuDefilement();

  useEffect(() => {
    if (role) return; // rôle déjà connu (cache module) : rien à faire
    let vivant = true;
    // secours immédiat depuis la session (rechargement dur) avant le réseau ;
    // sessionStorage n'existe pas côté serveur, d'où l'effet plutôt qu'un
    // état initial calculé directement
    const cache = sessionStorage.getItem("lsno_role");
    if (cache) { roleCache = cache; setRole(cache); } // eslint-disable-line react-hooks/set-state-in-effect
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
    <nav className={`tabbar${cachee ? " tabbar-cachee" : ""}`} aria-label="Navigation principale">
      {onglets.map((o) => (
        <Link key={o.href} href={o.href} className={`tab${actif === o.nom ? " on" : ""}`}>
          <o.Icone size={19} strokeWidth={1.8} aria-hidden />
          {o.nom}
        </Link>
      ))}
    </nav>
  );
}
