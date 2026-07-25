"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";

// Produit un carré 512x512 (JPEG ~85%) à partir de la zone choisie par
// l'utilisateur. L'image source est un object URL (même origine) : pas de
// souillure du canvas, toBlob fonctionne.
async function blobRecadre(src, zone) {
  const image = await new Promise((ok, ko) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = ko;
    i.src = src;
  });
  const T = 512;
  const canvas = document.createElement("canvas");
  canvas.width = T;
  canvas.height = T;
  canvas.getContext("2d").drawImage(
    image, zone.x, zone.y, zone.width, zone.height, 0, 0, T, T
  );
  return new Promise((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
}

export default function RecadrerPhoto({ src, onValider, onAnnuler }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [zone, setZone] = useState(null);
  const [enCours, setEnCours] = useState(false);

  const onComplete = useCallback((_, pixels) => setZone(pixels), []);

  const valider = async () => {
    if (!zone) return;
    setEnCours(true);
    try {
      onValider(await blobRecadre(src, zone));
    } catch {
      setEnCours(false);
    }
  };

  return (
    <div className="recadre" role="dialog" aria-modal="true" aria-label="Recadrer la photo">
      <p className="recadre-aide">Place et zoome ton visage dans le cadre.</p>
      <div className="recadre-scene">
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          aspect={1}
          showGrid={false}
          restrictPosition
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onComplete}
        />
      </div>
      <div className="recadre-ctrl">
        <input
          type="range" min={1} max={3} step={0.01} value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          aria-label="Zoom"
        />
        <div className="recadre-actions">
          <button type="button" className="btn btn-nu" onClick={onAnnuler} disabled={enCours}>
            Annuler
          </button>
          <button type="button" className="btn btn-or" onClick={valider} disabled={enCours}>
            {enCours ? "Enregistrement…" : "Valider"}
          </button>
        </div>
      </div>
    </div>
  );
}
