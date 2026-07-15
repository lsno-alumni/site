import Link from "next/link";
import { Users, Megaphone, Info, CircleUser, ShieldCheck } from "lucide-react";

const ONGLETS = [
  { href: "/annuaire", Icone: Users, nom: "Annuaire" },
  { href: "/offres", Icone: Megaphone, nom: "Offres" },
  { href: "/a-propos", Icone: Info, nom: "À propos" },
  { href: "/mon-profil", Icone: CircleUser, nom: "Mon profil" },
  { href: "/admin", Icone: ShieldCheck, nom: "Validation" },
];

export default function TabBar({ actif }) {
  return (
    <nav className="tabbar" aria-label="Navigation principale">
      {ONGLETS.map((o) => (
        <Link key={o.href} href={o.href} className={`tab${actif === o.nom ? " on" : ""}`}>
          <o.Icone size={19} strokeWidth={1.8} aria-hidden />
          {o.nom}
        </Link>
      ))}
    </nav>
  );
}
