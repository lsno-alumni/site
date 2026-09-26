import { ImageResponse } from "next/og";
import { creerClientServeur } from "@/lib/supabase/server";

// Une « voix » en image carrée, à partager sur WhatsApp : la citation en
// Fraunces sur bleu nuit, le prénom, la promo, le blason. Réservée aux
// membres (même règle de lecture que la page Conseils) : c'est le membre qui
// partage le FICHIER, pas un lien ; l'image ne dépend donc d'aucun accès public.
export const runtime = "nodejs";

let policeItalique = null;
async function fraunces() {
  if (policeItalique) return policeItalique;
  try {
    // Google Fonts sert un TTF quand on ne se présente pas comme un navigateur
    const css = await (await fetch("https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@1,500", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; lsno-amicale)" },
    })).text();
    const url = css.match(/src: url\(([^)]+)\) format\('(?:truetype|opentype)'\)/)?.[1];
    if (url) policeItalique = await (await fetch(url)).arrayBuffer();
  } catch { /* police de secours de satori */ }
  return policeItalique;
}

export async function GET(req, { params }) {
  const { id } = await params;
  const supabase = await creerClientServeur();
  const { data: p } = await supabase
    .from("profiles")
    .select("prenom, nom, photo_url, conseil, promotions(numero)")
    .eq("id", id).eq("statut_compte", "valide").maybeSingle();
  if (!p?.conseil) return new Response("Introuvable", { status: 404 });

  const origine = new URL(req.url).origin;
  const texte = p.conseil.trim();
  // taille de police selon la longueur : une phrase en grand, un paragraphe plus serré
  const taille = texte.length < 90 ? 62 : texte.length < 200 ? 50 : texte.length < 380 ? 40 : 32;
  const police = await fraunces();

  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
        background: "linear-gradient(160deg, #2B4E80 0%, #1E3A62 55%, #16294A 100%)", color: "#fff",
        padding: "84px 88px 72px", fontFamily: police ? "Fraunces" : "sans-serif", position: "relative",
      }}>
        <div style={{ position: "absolute", top: 30, right: 70, fontSize: 320, lineHeight: 1, color: "rgba(255,255,255,.12)", display: "flex" }}>“</div>
        <div style={{ display: "flex", fontSize: 24, letterSpacing: 10, color: "rgba(255,255,255,.75)", fontFamily: "sans-serif" }}>CONSEIL AUX CADETS</div>
        <div style={{ display: "flex", fontSize: taille, lineHeight: 1.3, fontStyle: "italic", flex: 1, alignItems: "center", paddingRight: 30 }}>
          {texte.length > 620 ? texte.slice(0, 600).trimEnd() + "…" : texte}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 26, fontFamily: "sans-serif" }}>
          {p.photo_url
            ? <img src={p.photo_url} width={96} height={96} style={{ borderRadius: 30, objectFit: "cover", border: "3px solid rgba(255,255,255,.7)" }} />
            : <div style={{ width: 96, height: 96, borderRadius: 30, background: "rgba(255,255,255,.14)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, fontWeight: 700 }}>{(p.prenom[0] + (p.nom?.[0] ?? "")).toUpperCase()}</div>}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 34, fontWeight: 700 }}>{p.prenom} {p.nom}</div>
            <div style={{ display: "flex", fontSize: 26, color: "rgba(255,255,255,.75)", marginTop: 6 }}>Promotion {p.promotions?.numero} · LSNO Amicale</div>
          </div>
          <img src={`${origine}/img/logo.jpg`} width={84} height={84} style={{ borderRadius: 42, marginLeft: "auto", border: "3px solid rgba(255,255,255,.7)" }} />
        </div>
      </div>
    ),
    {
      width: 1080, height: 1080,
      fonts: police ? [{ name: "Fraunces", data: police, style: "italic", weight: 500 }] : undefined,
      headers: { "Cache-Control": "private, max-age=300" },
    },
  );
}
