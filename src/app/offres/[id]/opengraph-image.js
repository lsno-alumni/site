import { ImageResponse } from "next/og";
import { apercuOffre } from "@/lib/api";
import { OG, TAILLE, ressourcesOG, Fond, Entete, POLICE_TITRE, POLICE_TEXTE } from "@/lib/og";

// Carte d'aperçu d'une offre partagée. Charte « Latérite » (03/10) : photo du
// lycée sous un voile bleu nuit, badge du type, tampon d'échéance comme dans
// l'appli. Pas de fragments <>…</> (satori superpose leurs enfants) :
// uniquement des divs conditionnels.
export const alt = "Offre sur LSNO Amicale";
export const size = TAILLE;
export const contentType = "image/png";

const TYPES = {
  stage: "STAGE", emploi: "EMPLOI", bourse: "BOURSE",
  cooptation: "COOPTATION", concours: "CONCOURS", autre: "OPPORTUNITÉ",
};
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export default async function Image({ params }) {
  const { id } = await params;
  const [o, r] = await Promise.all([apercuOffre(id), ressourcesOG()]);
  const lieu = o ? [o.ville, o.pays].filter(Boolean).join(", ") : "";
  const limite = o?.date_limite ? new Date(o.date_limite) : null;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", fontFamily: POLICE_TEXTE, color: OG.craie, position: "relative" }}>
        <Fond photo={r.photo} />
        <Entete blason={r.blason} suffixe=" · OFFRES" />

        <div style={{ position: "absolute", left: 70, top: 160, width: limite ? 720 : 900, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          {o && (
            <div style={{ fontSize: 24, letterSpacing: 4, color: "#FFFFFF", background: OG.accent, padding: "8px 18px", borderRadius: 100, display: "flex" }}>
              {TYPES[o.type] ?? "OPPORTUNITÉ"}
            </div>
          )}
          {o && (
            <div style={{ fontFamily: POLICE_TITRE, fontWeight: 500, fontSize: 54, lineHeight: 1.15, marginTop: 24, display: "flex" }}>{o.titre}</div>
          )}
          {o && o.entreprise && (
            <div style={{ fontSize: 32, color: OG.accentClair, marginTop: 18, display: "flex" }}>{o.entreprise}</div>
          )}
          {o && lieu && (
            <div style={{ fontSize: 28, color: OG.brume2, marginTop: 8, display: "flex" }}>{lieu}</div>
          )}
          {o && (
            <div style={{ fontSize: 24, color: OG.brume, marginTop: 36, display: "flex" }}>Publiée par un ancien, pour les anciens</div>
          )}

          {!o && (
            <div style={{ fontFamily: POLICE_TITRE, fontWeight: 500, fontSize: 58, lineHeight: 1.15, display: "flex" }}>Opportunités entre anciens du LSNO</div>
          )}
          {!o && (
            <div style={{ fontSize: 30, color: OG.brume2, marginTop: 20, display: "flex" }}>Stages, emplois, bourses, concours — partagés par ceux qui sont passés par là.</div>
          )}
        </div>

        {limite && (
          <div style={{ position: "absolute", right: 90, top: 150, width: 300, height: 300, borderRadius: 150, border: `4px solid ${OG.craie}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transform: "rotate(-8deg)" }}>
            <div style={{ fontSize: 17, letterSpacing: 3, color: OG.brume2, display: "flex" }}>CANDIDATER AVANT LE</div>
            <div style={{ fontFamily: POLICE_TITRE, fontSize: 72, lineHeight: 1, marginTop: 10, display: "flex" }}>{limite.getDate()} {MOIS[limite.getMonth()]}</div>
            <div style={{ fontSize: 22, letterSpacing: 3, color: OG.accentClair, marginTop: 10, display: "flex" }}>{limite.getFullYear()}</div>
          </div>
        )}
      </div>
    ),
    { ...TAILLE, fonts: r.fonts },
  );
}
