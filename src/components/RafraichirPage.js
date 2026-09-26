"use client";

import { useRouter } from "next/navigation";
import GlisserRafraichir from "@/components/GlisserRafraichir";

// Glisser-rafraîchir pour une page rendue par le SERVEUR (accueil connecté,
// conseils, profil consulté, offre) : le geste redemande la page à Next
// (`router.refresh()`), ce qui invalide aussi le cache du routeur de 30 s.
// Un délai minimum garde l'indicateur visible un instant même si la réponse
// arrive très vite, pour que le geste se sente confirmé.
export default function RafraichirPage({ children }) {
  const routeur = useRouter();
  const rafraichir = () => {
    routeur.refresh();
    return new Promise((r) => setTimeout(r, 600));
  };
  return <GlisserRafraichir onRafraichir={rafraichir}>{children}</GlisserRafraichir>;
}
