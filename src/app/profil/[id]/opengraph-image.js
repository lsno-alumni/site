import { ImageResponse } from "next/og";
import { apercuProfil } from "@/lib/api";

// Carte d'aperçu quand un profil est partagé (WhatsApp, etc.).
// N'expose que la vitrine choisie : nom, photo, promo, « en une ligne ».
// NB : pas de fragments <>…</> ici — satori superpose leurs enfants.
export const alt = "Profil sur LSNO Amicale";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const OR = "#E8B33C";
const OR_CLAIR = "#F5CD6E";
const CRAIE = "#F5F1E8";
const BRUME = "#93A5C0";

export default async function Image({ params }) {
  const { id } = await params;
  const p = await apercuProfil(id);

  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex", alignItems: "center",
        background: "linear-gradient(135deg, #0A1B33 0%, #102544 100%)",
        padding: 70, fontFamily: "sans-serif", position: "relative",
      }}>
        {/* liseré doré */}
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 14, background: OR, display: "flex" }} />

        <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingRight: 40 }}>
          <div style={{ fontSize: 26, letterSpacing: 8, color: OR, display: "flex" }}>LSNO AMICALE</div>

          {p && (
            <div style={{ fontSize: 64, fontWeight: 700, color: CRAIE, marginTop: 28, lineHeight: 1.1, display: "flex" }}>
              {p.prenom} {p.nom}
            </div>
          )}
          {p && (
            <div style={{ fontSize: 34, color: OR_CLAIR, marginTop: 18, display: "flex" }}>
              Promotion {p.promo}
            </div>
          )}
          {p && p.statut && (
            <div style={{ fontSize: 30, color: BRUME, marginTop: 12, display: "flex" }}>{p.statut}</div>
          )}
          {p && (
            <div style={{ fontSize: 26, color: BRUME, marginTop: 40, display: "flex" }}>
              Découvre son parcours sur le réseau des anciens
            </div>
          )}

          {!p && (
            <div style={{ fontSize: 60, fontWeight: 700, color: CRAIE, marginTop: 28, lineHeight: 1.15, display: "flex" }}>
              Le réseau des anciens du LSNO
            </div>
          )}
          {!p && (
            <div style={{ fontSize: 30, color: BRUME, marginTop: 22, display: "flex" }}>
              Parcours, conseils aux cadets et opportunités — entre anciens.
            </div>
          )}

          <div style={{ fontSize: 22, letterSpacing: 6, color: OR, marginTop: 46, display: "flex" }}>
            TRAVAIL · EXCELLENCE · DISCIPLINE
          </div>
        </div>

        {p && p.photo && (
          <img src={p.photo} width={300} height={300}
            style={{ borderRadius: 60, objectFit: "cover", border: `6px solid ${OR}` }} />
        )}
        {p && !p.photo && (
          <div style={{
            width: 300, height: 300, borderRadius: 60, display: "flex",
            alignItems: "center", justifyContent: "center", fontSize: 110, fontWeight: 700,
            color: "#0A1B33", background: `linear-gradient(135deg, ${OR}, ${OR_CLAIR})`,
          }}>
            {(p.prenom?.[0] ?? "") + (p.nom?.[0] ?? "")}
          </div>
        )}
      </div>
    ),
    { ...size }
  );
}
