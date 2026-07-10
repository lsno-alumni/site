// Les moteurs indexent les pages publiques ; les espaces membres sont
// de toute façon derrière connexion, on leur épargne des allers-retours.
export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/annuaire", "/profil/", "/mon-profil", "/admin"],
    },
    sitemap: "https://lsno-alumni.vercel.app/sitemap.xml",
  };
}
