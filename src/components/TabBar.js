import Link from "next/link";

const ONGLETS = [
  { href: "/annuaire", ico: "⌕", nom: "Annuaire" },
  { href: "/a-propos", ico: "ⓘ", nom: "À propos" },
  { href: "/mon-profil", ico: "◍", nom: "Mon profil" },
  { href: "/admin", ico: "✓", nom: "Validation" },
];

export default function TabBar({ actif }) {
  return (
    <nav className="tabbar" aria-label="Navigation principale">
      {ONGLETS.map((o) => (
        <Link key={o.href} href={o.href} className={`tab${actif === o.nom ? " on" : ""}`}>
          <span className="tico" aria-hidden>{o.ico}</span>
          {o.nom}
        </Link>
      ))}
    </nav>
  );
}
