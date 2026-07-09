"use client";

import { useRef, useState } from "react";
import { creerClientNavigateur } from "@/lib/supabase/client";

// Redimensionne l'image côté client (512px max, JPEG ~80%) :
// upload léger même en 3G, et stockage minimal.
async function compresser(fichier) {
  const image = await createImageBitmap(fichier);
  const max = 512;
  const ratio = Math.min(1, max / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * ratio);
  canvas.height = Math.round(image.height * ratio);
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise((ok) => canvas.toBlob(ok, "image/jpeg", 0.8));
}

export default function Photo({ profil, onPhoto, signale }) {
  const supabase = creerClientNavigateur();
  const entree = useRef(null);
  const [enCours, setEnCours] = useState(false);

  const choisir = async (e) => {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    if (!fichier.type.startsWith("image/")) {
      signale("Choisis une image (JPG, PNG…).");
      return;
    }
    setEnCours(true);
    try {
      const blob = await compresser(fichier);
      const chemin = `${profil.id}.jpg`;
      const { error } = await supabase.storage
        .from("photos")
        .upload(chemin, blob, { upsert: true, contentType: "image/jpeg" });
      if (error) throw new Error(`[stockage:${chemin}] ${error.message}`);
      const { data } = supabase.storage.from("photos").getPublicUrl(chemin);
      // cache-buster : l'URL publique reste identique après remplacement
      const url = `${data.publicUrl}?v=${Date.now()}`;
      const { error: errMaj } = await supabase
        .from("profiles").update({ photo_url: url }).eq("id", profil.id);
      if (errMaj) throw new Error(`[profil] ${errMaj.message}`);
      onPhoto(url);
      signale("Photo mise à jour ✓");
    } catch (err) {
      signale("Échec de l'envoi : " + err.message);
    } finally {
      setEnCours(false);
      e.target.value = "";
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      {profil.photo_url ? (
        <img src={profil.photo_url} alt="" className="p-photo" style={{ width: 72, height: 72, borderRadius: 24, border: "none" }} />
      ) : (
        <span className="avatar-init" style={{ width: 72, height: 72, borderRadius: 24, fontSize: 24 }}>
          {(profil.prenom[0] + (profil.nom[0] || "")).toUpperCase()}
        </span>
      )}
      <button className="btn btn-nu" onClick={() => entree.current.click()} disabled={enCours}>
        {enCours ? "Envoi…" : profil.photo_url ? "Changer la photo" : "Ajouter une photo"}
      </button>
      <input ref={entree} type="file" accept="image/*" onChange={choisir} hidden />
    </div>
  );
}
