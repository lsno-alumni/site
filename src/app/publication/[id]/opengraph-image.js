import { ImageResponse } from "next/og";
import { OG, TAILLE, ressourcesOG, Fond, Entete, POLICE_TITRE, POLICE_TEXTE } from "@/lib/og";

// Carte d'aperçu d'une publication partagée. Le contenu du fil est réservé
// aux membres (cercle de visibilité) : la carte reste GÉNÉRIQUE — elle ne
// montre ni le texte ni les photos, seulement l'invitation à se connecter.
export const alt = "Publication sur LSNO Amicale";
export const size = TAILLE;
export const contentType = "image/png";

export default async function Image() {
  const r = await ressourcesOG();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", fontFamily: POLICE_TEXTE, color: OG.craie, position: "relative" }}>
        <Fond photo={r.photo} />
        <Entete blason={r.blason} suffixe=" · LE FIL" />
        <div style={{ position: "absolute", left: 70, top: 180, width: 820, display: "flex", flexDirection: "column" }}>
          <div style={{ fontFamily: POLICE_TITRE, fontWeight: 500, fontSize: 60, lineHeight: 1.12, display: "flex" }}>Une publication d&apos;un ancien du LSNO</div>
          <div style={{ fontSize: 30, color: OG.brume2, marginTop: 24, lineHeight: 1.4, display: "flex" }}>Réservée aux membres du réseau. Connecte-toi pour la lire et y répondre.</div>
          <div style={{ fontSize: 22, letterSpacing: 6, color: OG.accentClair, marginTop: 46, display: "flex" }}>TRAVAIL · EXCELLENCE · DISCIPLINE</div>
        </div>
      </div>
    ),
    { ...TAILLE, fonts: r.fonts },
  );
}
