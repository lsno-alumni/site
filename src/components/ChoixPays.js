"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { LISTE_PAYS, PAYS, nomPays } from "@/lib/donnees";
import Surligne, { plat } from "@/components/Surligne";

// Champ « rechercher un pays » : jamais de texte libre — on tape pour
// filtrer, on CLIQUE un résultat, la valeur posée est toujours un vrai code
// ISO (donc toujours un drapeau). Remplace le menu déroulant à 253 entrées,
// bien plus rapide à l'usage sur mobile qu'un <select> qu'il faut faire
// défiler.
export default function ChoixPays({ id, valeur, onChange, obligatoire = false }) {
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const zoneRef = useRef(null);
  const champRef = useRef(null);

  const resultats = useMemo(() => {
    const q = plat(recherche.trim());
    const liste = q ? LISTE_PAYS.filter(([, nom]) => plat(nom).includes(q)) : LISTE_PAYS;
    return liste.slice(0, 8);
  }, [recherche]);

  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e) => { if (!zoneRef.current?.contains(e.target)) setOuvert(false); };
    document.addEventListener("pointerdown", dehors);
    return () => document.removeEventListener("pointerdown", dehors);
  }, [ouvert]);

  const choisir = (code) => {
    onChange(code);
    setRecherche("");
    setOuvert(false);
  };

  const ouvrir = () => {
    setRecherche("");
    setOuvert(true);
    // laisse le champ apparaître avant de le focaliser
    requestAnimationFrame(() => champRef.current?.focus());
  };

  return (
    <div ref={zoneRef} style={{ position: "relative" }}>
      {!ouvert && valeur && !obligatoire && (
        <button type="button" onClick={() => onChange(null)} aria-label="Retirer le pays"
          style={{
            position: "absolute", top: "50%", right: 12, transform: "translateY(-50%)",
            background: "none", border: "none", color: "var(--brume)", cursor: "pointer", padding: 4, zIndex: 1,
          }}>
          <X size={15} aria-hidden />
        </button>
      )}
      {ouvert ? (
        <div className="saisie" style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px 0 14px" }}>
          <Search size={15} strokeWidth={2} aria-hidden style={{ flexShrink: 0, color: "var(--brume)" }} />
          <input ref={champRef} id={id} type="text" value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setOuvert(false); if (e.key === "Enter" && resultats[0]) choisir(resultats[0][0]); }}
            placeholder="Rechercher un pays…" autoComplete="off"
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: "var(--craie)", font: "inherit", padding: "15px 0" }} />
          <button type="button" onClick={() => setOuvert(false)} aria-label="Fermer"
            style={{ background: "none", border: "none", color: "var(--brume)", cursor: "pointer", padding: 6, flexShrink: 0 }}>
            <X size={16} aria-hidden />
          </button>
        </div>
      ) : (
        <button type="button" id={id} className="saisie" onClick={ouvrir}
          style={{
            display: "flex", alignItems: "center", gap: 9, cursor: "pointer", textAlign: "left",
            paddingRight: valeur && !obligatoire ? 38 : undefined,
          }}>
          {valeur && PAYS[valeur]
            ? <>
                <img className="drapo" src={PAYS[valeur].drapeau} alt="" />
                <span>{nomPays(valeur)}</span>
              </>
            : <span style={{ color: "var(--brume)" }}>{obligatoire ? "— Choisir —" : "Non précisé"}</span>}
        </button>
      )}

      {ouvert && (
        <div className="carte-sombre" role="listbox" style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 30,
          maxHeight: 260, overflowY: "auto", padding: 6,
          boxShadow: "0 20px 40px -12px rgba(0,0,0,.5)",
        }}>
          {resultats.length === 0 && (
            <p style={{ padding: "12px 10px", fontSize: 13, color: "var(--brume)" }}>Aucun pays trouvé.</p>
          )}
          {resultats.map(([code, nom]) => (
            <button key={code} type="button" role="option" aria-selected={code === valeur} onClick={() => choisir(code)}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                background: code === valeur ? "rgba(232,179,60,.12)" : "none", border: "none",
                borderRadius: 12, padding: "10px 10px", cursor: "pointer", color: "var(--craie)", font: "inherit",
              }}>
              <img className="drapo" src={PAYS[code].drapeau} alt="" />
              <span><Surligne texte={nom} terme={recherche} /></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
