"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { creerClientNavigateur } from "@/lib/supabase/client";
import Visionneuse from "@/components/Visionneuse";

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
  const [agrandie, setAgrandie] = useState(false);

  const initiales = (profil.prenom[0] + (profil.nom[0] || "")).toUpperCase();

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
    <div className="photo-edit">
      <div className="photo-edit-cadre">
        {profil.photo_url ? (
          <img
            src={profil.photo_url}
            alt="Ma photo de profil"
            className="photo-edit-img"
            onClick={() => setAgrandie(true)}
          />
        ) : (
          <span className="avatar-init photo-edit-img" style={{ fontSize: 26 }}>{initiales}</span>
        )}
        <button
          type="button"
          className="photo-edit-bouton"
          onClick={() => entree.current.click()}
          disabled={enCours}
          aria-label={profil.photo_url ? "Changer la photo" : "Ajouter une photo"}
        >
          <Camera size={16} strokeWidth={2} aria-hidden />
        </button>
      </div>
      <span className="photo-edit-aide">
        {enCours
          ? "Envoi…"
          : profil.photo_url
            ? "Touche l'appareil pour changer · la photo pour l'agrandir"
            : "Touche l'appareil photo pour en ajouter une"}
      </span>
      <input ref={entree} type="file" accept="image/*" onChange={choisir} hidden />
      {agrandie && (
        <Visionneuse src={profil.photo_url} alt="Ma photo de profil" onClose={() => setAgrandie(false)} />
      )}
    </div>
  );
}
