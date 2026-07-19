// Rend le site « installable » : Ajouter à l'écran d'accueil donne une
// vraie icône, un nom court et un plein écran aux couleurs du site.
export default function manifest() {
  return {
    name: "LSNO Amicale",
    short_name: "LSNO Amicale",
    description: "Le réseau des anciens du Lycée Scientifique National de Ouagadougou.",
    start_url: "/",
    display: "standalone",
    background_color: "#0A1B33",
    theme_color: "#0A1B33",
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png" },
      // versions « maskable » : blason en médaillon rond sur fond encre —
      // Android les utilise pour l'icône ET le splash d'installation
      { src: "/icone-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
