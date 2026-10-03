import { ImageResponse } from "next/og";
import { OG, TAILLE, ressourcesOG, Fond, Entete, POLICE_TITRE, POLICE_TEXTE } from "@/lib/og";

// Carte d'aperçu d'un événement partagé. Les événements sont réservés aux
// membres (cercle de visibilité) : la carte reste GÉNÉRIQUE — ni le titre, ni
// le lieu, ni la date, seulement l'invitation à se connecter.
export const alt = "Événement sur LSNO Amicale";
export const size = TAILLE;
export const contentType = "image/png";

export default async function Image() {
  const r = await ressourcesOG();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", fontFamily: POLICE_TEXTE, color: OG.craie, position: "relative" }}>
        <Fond photo={r.photo} />
        <Entete blason={r.blason} suffixe=" · ÉVÉNEMENTS" />
        <div style={{ position: "absolute", left: 70, top: 180, width: 820, display: "flex", flexDirection: "column" }}>
          <div style={{ fontFamily: POLICE_TITRE, fontWeight: 500, fontSize: 60, lineHeight: 1.12, display: "flex" }}>Un événement entre anciens du LSNO</div>
          <div style={{ fontSize: 30, color: OG.brume2, marginTop: 24, lineHeight: 1.4, display: "flex" }}>Réservé aux membres du réseau. Connecte-toi pour voir les détails et répondre à l&apos;invitation.</div>
          <div style={{ fontSize: 22, letterSpacing: 6, color: OG.accentClair, marginTop: 46, display: "flex" }}>TRAVAIL · EXCELLENCE · DISCIPLINE</div>
        </div>
      </div>
    ),
    { ...TAILLE, fonts: r.fonts },
  );
}
