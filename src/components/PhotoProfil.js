"use client";

import { useState } from "react";
import Visionneuse from "@/components/Visionneuse";

// Photo d'un profil consulté : cliquable pour l'agrandir. Repli sur les
// initiales si pas de photo (non cliquable).
export default function PhotoProfil({ profil }) {
  const [agrandie, setAgrandie] = useState(false);

  if (!profil.photo) {
    const initiales = (profil.prenom[0] + (profil.nom[0] || "")).toUpperCase();
    return <span className="avatar-init p-photo">{initiales}</span>;
  }
  return (
    <>
      <img
        src={profil.photo}
        alt={`Photo de ${profil.prenom} ${profil.nom}`}
        className="p-photo"
        style={{ cursor: "zoom-in" }}
        onClick={() => setAgrandie(true)}
      />
      {agrandie && (
        <Visionneuse
          src={profil.photo}
          alt={`Photo de ${profil.prenom} ${profil.nom}`}
          onClose={() => setAgrandie(false)}
        />
      )}
    </>
  );
}
