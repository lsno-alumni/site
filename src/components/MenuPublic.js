"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

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
        {ouvert ? "✕" : "☰"}
      </button>
      {ouvert && (
        <nav className="menu-panneau" style={{ top: 48, right: 0 }}>
          <Link href="/connexion" onClick={() => setOuvert(false)}>→ Se connecter</Link>
          <Link href="/inscription" className="dore" onClick={() => setOuvert(false)}>✦ Rejoindre le réseau</Link>
          <Link href="/a-propos" onClick={() => setOuvert(false)}>ⓘ À propos</Link>
        </nav>
      )}
    </div>
  );
}
