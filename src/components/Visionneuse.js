"use client";

import ImageRobuste from "@/components/MediaRobuste";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

// La visionneuse plein écran : une photo à la fois, glissement du doigt ou
// flèches pour passer à la suivante, compteur, croix ou Échap pour fermer.
// Appel à une photo : { src, alt, onClose } (photo de profil) ; à plusieurs :
// { urls, depart, onFermer }.
export default function Visionneuse({ urls: liste, src, alt = "", depart = 0, onFermer: fermerProp, onClose }) {
  const urls = liste ?? [src];
  const onFermer = fermerProp ?? onClose;
  const [i, setI] = useState(depart);
  const [decal, setDecal] = useState(0);
  const geste = useRef(null);
  const n = urls.length;
  const aller = (k) => setI(((k % n) + n) % n);

  useEffect(() => {
    const touche = (e) => { if (e.key === "Escape") onFermer(); if (e.key === "ArrowRight") aller(i + 1); if (e.key === "ArrowLeft") aller(i - 1); };
    document.addEventListener("keydown", touche);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", touche); document.body.style.overflow = overflow; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, n]);

  const debut = (e) => { geste.current = { x0: e.clientX, id: e.pointerId }; e.currentTarget.setPointerCapture?.(e.pointerId); };
  const bouge = (e) => { if (geste.current) setDecal(e.clientX - geste.current.x0); };
  const fin = () => {
    if (!geste.current) return;
    if (decal < -60) aller(i + 1); else if (decal > 60) aller(i - 1);
    geste.current = null; setDecal(0);
  };

  return createPortal(
    <div className={`visionneuse${liste ? " galerie" : ""}`} role="dialog" aria-modal="true" aria-label={n > 1 ? `Photo ${i + 1} sur ${n}` : alt || "Photo agrandie"} onClick={onFermer}>
      <button type="button" className="visionneuse-fermer" onClick={onFermer} aria-label="Fermer"><X size={22} aria-hidden /></button>
      {n > 1 && <span className="visionneuse-compteur">{i + 1} / {n}</span>}
      <div className="visionneuse-scene" onClick={(e) => e.stopPropagation()}
        onPointerDown={debut} onPointerMove={bouge} onPointerUp={fin} onPointerCancel={fin}>
        <ImageRobuste src={urls[i]} alt={alt} draggable={false} style={{ transform: decal ? `translateX(${decal}px)` : undefined, transition: decal ? "none" : "transform .2s" }} />
      </div>
      {n > 1 && (
        <>
          <button type="button" className="visionneuse-fleche gauche" onClick={(e) => { e.stopPropagation(); aller(i - 1); }} aria-label="Photo précédente"><ChevronLeft size={26} aria-hidden /></button>
          <button type="button" className="visionneuse-fleche droite" onClick={(e) => { e.stopPropagation(); aller(i + 1); }} aria-label="Photo suivante"><ChevronRight size={26} aria-hidden /></button>
          <div className="visionneuse-points" aria-hidden>{urls.map((_, k) => <span key={k} className={k === i ? "on" : ""} />)}</div>
        </>
      )}
    </div>,
    document.body
  );
}
