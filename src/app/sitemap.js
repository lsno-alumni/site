export default function sitemap() {
  const base = "https://lsno-alumni.vercel.app";
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/a-propos`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/inscription`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/connexion`, changeFrequency: "monthly", priority: 0.4 },
  ];
}
