import { readFile } from "fs/promises";
import path from "path";

// Les cartes de partage (Open Graph : WhatsApp, etc.) générées côté serveur
// par satori (next/og). Ce module leur donne la charte « Latérite » : bleu
// nuit, un seul accent bleu, craie ; les polices du site (WOFF, satori ne lit
// pas le WOFF2 de next/font) ; le blason et une photo du lycée, lus une fois
// sur le disque et incorporés en data: (satori ne va pas les chercher sur le
// réseau pendant le rendu). Pas de fragments <>…</> dans les cartes : satori
// superpose leurs enfants.
export const OG = {
  nuit: "#1B2F4F", nuit2: "#23406B", accent: "#3B6FD1", accentClair: "#8FBBFF",
  craie: "#F6F0E4", brume: "#A9B4C8", brume2: "#C9CFDB",
};
export const TAILLE = { width: 1200, height: 630 };

let cache = null;
export async function ressourcesOG() {
  if (cache && process.env.NODE_ENV === "production") return cache;   // en développement, on relit (les visuels changent)
  const racine = process.cwd();
  const lire = (p) => readFile(path.join(racine, p));
  const [fraunces, sans, sansGras, blason, photo] = await Promise.all([
    lire("src/app/polices/fraunces-500.woff"), lire("src/app/polices/instrument-sans-400.woff"), lire("src/app/polices/instrument-sans-600.woff"),
    lire("public/img/logo-email.png"), lire("public/img/og-fond.jpg"),
  ]);
  cache = {
    fonts: [
      { name: "Fraunces", data: fraunces, weight: 500, style: "normal" },
      { name: "Instrument Sans", data: sans, weight: 400, style: "normal" },
      { name: "Instrument Sans", data: sansGras, weight: 600, style: "normal" },
    ],
    blason: `data:image/png;base64,${blason.toString("base64")}`,
    photo: `data:image/jpeg;base64,${photo.toString("base64")}`,
  };
  return cache;
}

// fond : dégradé bleu nuit, ou la photo du lycée déjà voilée de bleu nuit (public/img/og-fond.jpg,
// voile cuit dans le fichier et léger flou : WhatsApp n'affiche pas une image d'aperçu trop lourde,
// et un PNG de photo nette dépassait 850 Ko)
export function Fond({ photo }) {
  if (!photo) return <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: `linear-gradient(135deg, ${OG.nuit} 0%, ${OG.nuit2} 100%)`, display: "flex" }} />;
  return <img src={photo} width={1200} height={630} style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630 }} alt="" />;
}

// liseré gauche + en-tête : blason en médaillon et « LSNO AMICALE »
export function Entete({ blason, suffixe = "" }) {
  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 14, background: OG.accent, display: "flex" }} />
      <div style={{ position: "absolute", left: 70, top: 58, display: "flex", alignItems: "center" }}>
        <img src={blason} width={64} height={64} style={{ borderRadius: 32 }} alt="" />
        <div style={{ fontSize: 26, letterSpacing: 8, color: OG.accentClair, marginLeft: 16, display: "flex" }}>LSNO AMICALE{suffixe}</div>
      </div>
    </div>
  );
}

export const POLICE_TITRE = "Fraunces";
export const POLICE_TEXTE = "Instrument Sans";
