"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Users, Megaphone, CircleUser, MessageCircle, Newspaper } from "lucide-react";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import { sautRecent, derniereAdresse } from "@/components/SuiviNavigation";
import { nonLus, ecouterTousMessages, marquerRecu, marquerRecuTout } from "@/lib/messages";
import { momentsNonVus } from "@/lib/moments";

// 5 onglets, les MÊMES pour tout le monde (décision du 26/09, chantier
// « réseau social ») : Fil, Annuaire, Offres, Messages, Mon profil.
// À propos est passé dans le menu ☰, la bande « Mon compte » et le sceau ;
// Validation (délégués/admins) se rejoint par l'alerte en haut de l'accueil
// et par « Espace admin » dans la bande « Mon compte » de Mon profil.
const ONGLETS = [
  { href: "/fil", Icone: Newspaper, nom: "Fil" },
  { href: "/annuaire", Icone: Users, nom: "Annuaire" },
  { href: "/offres", Icone: Megaphone, nom: "Offres" },
  { href: "/messages", Icone: MessageCircle, nom: "Messages" },
  { href: "/mon-profil", Icone: CircleUser, nom: "Mon profil" },
];

// Cache au niveau MODULE : survit aux navigations client (contrairement à
// l'état React qui se réinitialise à chaque remontage de la TabBar) → dès la
// 2e page, le rôle est connu au 1er rendu = plus aucun clignotement 4→5.
// Écrit UNIQUEMENT dans le useEffect (côté client) → jamais côté serveur
// (pas de fuite entre utilisateurs, pas de décalage d'hydratation).
let roleCache = null;
// Un visiteur NON connecté (À propos, Conditions… en public) n'a pas de barre :
// les onglets mènent tous à des pages réservées. Connu après le premier
// contrôle de session, puis mémorisé au niveau module pour que les pages
// publiques suivantes ne la fassent même pas apparaître un instant.
let connecteCache = null;   // null = pas encore su, true/false ensuite
let nonLusCache = 0;        // messages non lus (pastille de l'onglet Messages)
let momentsCache = 0;       // moments non vus (point sur l'onglet Fil)
const CLASSE_SANS = "sans-tabbar";

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
  const chemin = usePathname();
  // une feuille qui se ferme (ou toute navigation) ne déclenche aucun
  // défilement : si la page est en haut, la barre doit être là — sinon elle
  // restait cachée jusqu'au prochain geste vers le haut
  useEffect(() => {
    const t = setTimeout(() => { if (window.scrollY < SEUIL_HAUT) setCachee(false); }, 60);
    return () => clearTimeout(t);
  }, [chemin]);

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
      // saut programmé (restauration de la position d'un onglet) : ce n'est pas
      // un geste vers le bas, la barre reste en place
      if (sautRecent()) return;

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
  const routeur = useRouter();
  const [role, setRole] = useState(roleCache);
  const [connecte, setConnecte] = useState(connecteCache ?? (roleCache ? true : null));
  // pastille des messages non lus : lue à chaque page (la barre remonte à
  // chaque navigation), gardée au niveau module pour ne pas clignoter
  const [nonLu, setNonLu] = useState(nonLusCache);
  const [moments, setMoments] = useState(momentsCache);
  useEffect(() => {
    if (connecte === false) return;
    let vivant = true;
    const lireMoments = () => momentsNonVus().then((n) => { if (vivant) { momentsCache = n; setMoments(n); } }).catch(() => {});
    lireMoments();
    window.addEventListener("lsno:moments", lireMoments);
    const lire = () => nonLus().then((n) => {
      if (!vivant) return;
      nonLusCache = n; setNonLu(n);
      // pastille sur l'icône de l'appli installée (Android, ordinateur) : rien à demander à l'utilisateur
      try { if (n > 0) navigator.setAppBadge?.(n); else navigator.clearAppBadge?.(); } catch { /* non pris en charge */ }
    }).catch(() => {});
    lire();
    // l'appli est ouverte : tout ce qui m'attendait est « reçu » (coches grises chez l'expéditeur)
    marquerRecuTout();
    // temps réel : la pastille bouge dès qu'un message arrive, où qu'on soit — et il est reçu
    const stop = ecouterTousMessages((m, type) => { lire(); if (type === "INSERT") marquerRecu(m?.conversation_id); });
    return () => { vivant = false; stop(); window.removeEventListener("lsno:moments", lireMoments); };
  }, [connecte, actif]);
  // le réseau revient : toutes les listes se relisent (elles écoutent lsno:rafraichir)
  useEffect(() => {
    const retour = () => window.dispatchEvent(new CustomEvent("lsno:rafraichir"));
    window.addEventListener("online", retour);
    return () => window.removeEventListener("online", retour);
  }, []);
  const cachee = useCacherAuDefilement();

  // la page libère la place réservée à la barre quand il n'y en a pas
  useEffect(() => {
    document.documentElement.classList.toggle(CLASSE_SANS, connecte === false);
    return () => document.documentElement.classList.remove(CLASSE_SANS);
  }, [connecte]);

  useEffect(() => {
    if (role) { connecteCache = true; return; } // rôle déjà connu (cache module) : connecté, rien à refaire
    let vivant = true;
    // secours immédiat depuis la session (rechargement dur) avant le réseau ;
    // sessionStorage n'existe pas côté serveur, d'où l'effet plutôt qu'un
    // état initial calculé directement
    const cache = sessionStorage.getItem("lsno_role");
    if (cache) { roleCache = cache; setRole(cache); } // eslint-disable-line react-hooks/set-state-in-effect
    (async () => {
      const supabase = creerClientNavigateur();
      const { data: { user } } = await supabase.auth.getUser();
      if (!vivant) return;
      connecteCache = Boolean(user);
      setConnecte(Boolean(user));
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

  const onglets = ONGLETS;

  // Un onglet est un ÉTAT, pas une page (comme dans une appli) :
  //  - un tap sur l'onglet déjà actif remonte en haut ;
  //  - un tap sur un autre onglet ramène à sa dernière adresse complète
  //    (recherche et filtres compris), à la position mémorisée — SuiviNavigation
  //    a déjà noté le tap (écouteur en capture) quand on arrive ici.
  const auTap = (e, o) => {
    if (actif === o.nom) {
      e.preventDefault();
      // déjà en haut : on recharge (même geste que tirer vers le bas) ; sinon on remonte
      if (window.scrollY <= 40) { window.dispatchEvent(new CustomEvent("lsno:rafraichir")); routeur.refresh(); }
      else window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const adresse = derniereAdresse(o.href);
    if (adresse && adresse !== o.href) {
      e.preventDefault();
      routeur.push(adresse, { scroll: false });
    }
  };

  if (connecte === false) return null;
  return (
    <nav className={`tabbar${cachee ? " tabbar-cachee" : ""}`} aria-label="Navigation principale">
      {/* scroll={false} : c'est RestaurerDefilement (SuiviNavigation.js) qui place la
          page — à la position mémorisée de l'onglet, ou en haut — d'un coup, sans
          le glissement vers le haut que Next ferait après coup.
          prefetch : les onglets sont chargés en arrière-plan dès l'ouverture (en
          production seulement) et gardés 5 min — le premier tap est instantané */}
      {onglets.map((o) => (
        <Link key={o.href} href={o.href} scroll={false} prefetch={true} onClick={(e) => auTap(e, o)}
          className={`tab${actif === o.nom ? " on" : ""}`}>
          <o.Icone size={19} strokeWidth={1.8} aria-hidden />
          {o.nom}
          {o.nom === "Messages" && nonLu > 0 && <span className="tab-pastille" aria-label={`${nonLu} non lus`}>{nonLu > 99 ? "99+" : nonLu}</span>}
          {o.nom === "Fil" && moments > 0 && actif !== "Fil" && <span className="tab-point" aria-label={`${moments} moment${moments > 1 ? "s" : ""} à voir`} />}
        </Link>
      ))}
    </nav>
  );
}
