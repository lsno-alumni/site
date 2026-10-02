"use client";

import { useRouter } from "next/navigation";
import FeuilleGlissante from "@/components/FeuilleGlissante";

// L'écran d'attente d'une feuille interceptée (loading.js des routes @modal) :
// au tap, la feuille glisse TOUT DE SUITE avec une silhouette, et le vrai
// contenu la remplace quand le serveur répond. Sans lui, rien ne bougeait
// pendant 1 à 3 s — c'était « la latence » rapportée par le comité.
//   plein : feuilles de création (composer, nouveau groupe…), ouvertes entières
//   sinon : fiches (profil, offre, événement, question…), ouvertes en aperçu
export default function SqueletteFeuille({ plein = false, titre = false }) {
  const router = useRouter();
  return (
    <FeuilleGlissante depart={plein ? "plein" : "peek"} sansFermer={plein} onFermer={() => router.back()}
      tete={plein
        ? <div className="sq-feuille-tete" aria-hidden><span className="sk sk-ligne" style={{ width: 160, height: 18 }} /></div>
        : <div aria-hidden>
            <div className="sk" style={{ height: 150, borderRadius: 0 }} />
            <div className="p-corps" style={{ paddingBottom: 8 }}>
              <span className="sk" style={{ display: "block", width: 92, height: 92, borderRadius: 32, marginTop: -46 }} />
              <span className="sk sk-ligne" style={{ display: "block", width: "55%", height: 20, marginTop: 16 }} />
              <span className="sk sk-ligne" style={{ display: "block", width: "75%", marginTop: 10 }} />
            </div>
          </div>}>
      <div aria-hidden style={{ padding: "8px 20px 40px", display: "grid", gap: 14 }}>
        {titre && <span className="sk sk-ligne" style={{ width: "70%", height: 22 }} />}
        <div style={{ display: "flex", gap: 8 }}>
          <span className="sk" style={{ flex: 1, height: 44, borderRadius: 100 }} />
          <span className="sk" style={{ flex: 1, height: 44, borderRadius: 100 }} />
        </div>
        <span className="sk sk-ligne" style={{ width: 90, height: 10, marginTop: 8 }} />
        <span className="sk sk-ligne" style={{ width: "88%" }} />
        <span className="sk sk-ligne" style={{ width: "72%" }} />
        <span className="sk sk-ligne" style={{ width: "80%" }} />
        <span className="sk sk-ligne" style={{ width: 90, height: 10, marginTop: 8 }} />
        <span className="sk sk-ligne" style={{ width: "60%" }} />
        <span className="sk sk-ligne" style={{ width: "66%" }} />
      </div>
    </FeuilleGlissante>
  );
}
