import { ImageResponse } from "next/og";
import { apercuOffre } from "@/lib/api";

// Carte d'aperçu d'une offre partagée. Pas de fragments <>…</> (satori
// superpose leurs enfants) : uniquement des divs conditionnels.
export const alt = "Offre sur LSNO Amicale";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const OR = "#E8B33C";
const OR_CLAIR = "#F5CD6E";
const CRAIE = "#F5F1E8";
const BRUME = "#93A5C0";
const TYPES = {
  stage: "STAGE", emploi: "EMPLOI", bourse: "BOURSE",
  cooptation: "COOPTATION", concours: "CONCOURS", autre: "OPPORTUNITÉ",
};

export default async function Image({ params }) {
  const { id } = await params;
  const o = await apercuOffre(id);
  const lieu = o ? [o.ville, o.pays].filter(Boolean).join(", ") : "";
  const echeance = o?.date_limite
    ? new Date(o.date_limite).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex", alignItems: "center",
        background: "linear-gradient(135deg, #0A1B33 0%, #102544 100%)",
        padding: 70, fontFamily: "sans-serif", position: "relative",
      }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 14, background: OR, display: "flex" }} />

        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ fontSize: 26, letterSpacing: 8, color: OR, display: "flex" }}>LSNO AMICALE · OFFRES</div>

          {o && (
            <div style={{ display: "flex", marginTop: 34 }}>
              <div style={{
                fontSize: 28, letterSpacing: 4, color: "#0A1B33", background: OR,
                padding: "10px 26px", borderRadius: 100, fontWeight: 700, display: "flex",
              }}>
                {TYPES[o.type] ?? "OPPORTUNITÉ"}
              </div>
            </div>
          )}
          {o && (
            <div style={{ fontSize: 54, fontWeight: 700, color: CRAIE, marginTop: 26, lineHeight: 1.2, display: "flex" }}>
              {o.titre}
            </div>
          )}
          {o && echeance && (
            <div style={{ fontSize: 32, color: OR_CLAIR, marginTop: 20, display: "flex" }}>
              Avant le {echeance}
            </div>
          )}
          {o && lieu && (
            <div style={{ fontSize: 28, color: BRUME, marginTop: 10, display: "flex" }}>{lieu}</div>
          )}
          {o && (
            <div style={{ fontSize: 26, color: BRUME, marginTop: 36, display: "flex" }}>
              Partagée entre anciens — connecte-toi pour les détails
            </div>
          )}

          {!o && (
            <div style={{ fontSize: 58, fontWeight: 700, color: CRAIE, marginTop: 30, lineHeight: 1.15, display: "flex" }}>
              Offres &amp; opportunités
            </div>
          )}
          {!o && (
            <div style={{ fontSize: 30, color: BRUME, marginTop: 20, display: "flex" }}>
              Stages, bourses, cooptations — partagés entre anciens du LSNO.
            </div>
          )}

          <div style={{ fontSize: 22, letterSpacing: 6, color: OR, marginTop: 44, display: "flex" }}>
            TRAVAIL · EXCELLENCE · DISCIPLINE
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
