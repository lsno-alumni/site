"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X, LogIn, Sparkles, Info } from "lucide-react";

export default function MenuPublic() {
  const [ouvert, setOuvert] = useState(false);
  const zone = useRef(null);

  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e) => { if (!zone.current?.contains(e.target)) setOuvert(false); };
    document.addEventListener("click", fermer);
    return () => document.removeEventListener("click", fermer);
  }, [ouvert]);

  return (
    <div ref={zone} style={{ position: "relative" }}>
      <button className="a-menu" aria-label="Menu" aria-expanded={ouvert}
        onClick={() => setOuvert(!ouvert)}>
        {ouvert ? <X size={17} aria-hidden /> : <Menu size={17} aria-hidden />}
      </button>
      {ouvert && (
        <nav className="menu-panneau" style={{ top: 48, right: 0 }}>
          <Link href="/connexion" onClick={() => setOuvert(false)}>
            <LogIn size={16} strokeWidth={1.8} aria-hidden /> Se connecter
          </Link>
          <Link href="/inscription" className="dore" onClick={() => setOuvert(false)}>
            <Sparkles size={16} strokeWidth={1.8} aria-hidden /> Rejoindre le réseau
          </Link>
          <Link href="/a-propos" onClick={() => setOuvert(false)}>
            <Info size={16} strokeWidth={1.8} aria-hidden /> À propos
          </Link>
        </nav>
      )}
    </div>
  );
}
