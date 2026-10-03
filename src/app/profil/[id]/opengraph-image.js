import { ImageResponse } from "next/og";
import { apercuProfil } from "@/lib/api";
import { OG, TAILLE, ressourcesOG, Fond, Entete, POLICE_TITRE, POLICE_TEXTE } from "@/lib/og";

// Carte d'aperçu quand un profil est partagé (WhatsApp, etc.).
// N'expose que la vitrine choisie : nom, photo, promo, « en une ligne ».
// Charte « Latérite » (03/10) : bleu nuit, accent bleu, craie, blason, le
// portrait de la personne en médaillon quand sa vitrine en a un.
// NB : pas de fragments <>…</> ici — satori superpose leurs enfants.
export const alt = "Profil sur LSNO Amicale";
export const size = TAILLE;
export const contentType = "image/png";

export default async function Image({ params }) {
  const { id } = await params;
  const [p, r] = await Promise.all([apercuProfil(id), ressourcesOG()]);
  const portrait = p?.photo && /^https?:\/\//.test(p.photo) ? p.photo : null;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", fontFamily: POLICE_TEXTE, color: OG.craie, position: "relative" }}>
        <Fond photo={portrait ? null : r.photo} />
        <Entete blason={r.blason} />

        <div style={{ position: "absolute", left: 70, top: 170, width: portrait ? 700 : 760, display: "flex", flexDirection: "column" }}>
          {p && (
            <div style={{ fontFamily: POLICE_TITRE, fontWeight: 500, fontSize: 64, lineHeight: 1.1, display: "flex" }}>
              {p.prenom} {p.nom}
            </div>
          )}
          {p && (
            <div style={{ fontSize: 34, color: OG.accentClair, marginTop: 16, display: "flex" }}>Promotion {p.promo}</div>
          )}
          {p && p.statut && (
            <div style={{ fontSize: 30, color: OG.brume2, marginTop: 10, display: "flex" }}>{p.statut}</div>
          )}
          {p && (
            <div style={{ fontSize: 26, color: OG.brume, marginTop: 40, display: "flex" }}>Découvre son parcours sur le réseau des anciens</div>
          )}

          {!p && (
            <div style={{ fontFamily: POLICE_TITRE, fontWeight: 500, fontSize: 62, lineHeight: 1.1, display: "flex" }}>Le réseau des anciens du LSNO</div>
          )}
          {!p && (
            <div style={{ fontSize: 30, color: OG.brume2, marginTop: 22, display: "flex" }}>Parcours, conseils aux cadets et opportunités — entre anciens.</div>
          )}
        </div>

        {portrait && (
          <div style={{ position: "absolute", right: 90, top: 135, width: 360, height: 360, borderRadius: 180, overflow: "hidden", border: "6px solid rgba(143,187,255,.55)", display: "flex", boxShadow: "0 30px 80px rgba(0,0,0,.45)" }}>
            <img src={portrait} width={360} height={360} style={{ width: 360, height: 360, objectFit: "cover" }} alt="" />
          </div>
        )}
      </div>
    ),
    { ...TAILLE, fonts: r.fonts },
  );
}
