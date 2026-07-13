"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

// Affiche une image en plein écran (lightbox). Fermeture au clic, à la croix
// ou avec Échap. Bloque le défilement de la page tant qu'elle est ouverte.
export default function Visionneuse({ src, alt = "", onClose }) {
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="visionneuse" onClick={onClose} role="dialog" aria-modal="true" aria-label="Photo agrandie">
      <button className="visionneuse-fermer" aria-label="Fermer" onClick={onClose}>
        <X size={22} aria-hidden />
      </button>
      <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
    </div>
  );
}
