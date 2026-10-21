// Garantie « le mobile ne bouge pas » du chantier bureau (21/10).
//   node outils/bureau-ref.js ref       → photos de référence des écrans mobiles (Pixel 7, 2 thèmes)
//   node outils/bureau-ref.js apres     → mêmes photos après modification ; puis  python outils/bureau-diff.py  compare pixel par pixel
//   node outils/bureau-ref.js bureau    → captures grand écran (1280 et 1440) pour relecture
// Écrans publics seulement sans identifiants ; avec B_EMAIL/B_MDP (captcha coupé), les écrans membres aussi.
const { chromium, devices } = require("playwright");
const fs = require("fs"); const path = require("path");
const BASE = process.env.BASE || "http://localhost:3007";
const DOSSIER = path.join(__dirname, "..", "..", "bureau-captures");
const PUBLICS = ["/", "/connexion", "/inscription", "/connexion/lien", "/mot-de-passe/oubli", "/conditions", "/a-propos"];
const MEMBRES = ["/", "/annuaire", "/fil", "/offres", "/messages", "/mon-profil", "/conseils", "/questions", "/evenements", "/bibliotheque", "/nouveautes", "/a-propos", "/admin"];
const mode = process.argv[2] || "ref";
const nom = (route, theme, largeur) => `${route === "/" ? "accueil" : route.slice(1).replace(/\W+/g, "_")}--${theme}${largeur ? "--" + largeur : ""}.png`;

// stabilité des photos : hasard figé (nuage de pays, voisins…) et captcha Turnstile bloqué (il apparaît ou non selon le réseau)
const init = (theme) => `
  (() => { let g = 123456789; Math.random = () => { g = (g * 1103515245 + 12345) & 0x7fffffff; return g / 0x7fffffff; }; })();
  localStorage.setItem("lsno-theme", "${theme}");
  const poser = () => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important} *,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;caret-color:transparent!important} .np-zone{visibility:hidden!important}";   /* le nuage de pays bouge en continu (animation physique) : masqué, son cadre reste mesuré */ (document.head || document.documentElement).appendChild(s); };
  if (document.head) poser(); else document.addEventListener("DOMContentLoaded", poser);`;

async function connecter(p) {
  if (!process.env.B_EMAIL) return false;
  await p.goto(BASE + "/connexion", { timeout: 240000, waitUntil: "domcontentloaded" }); await p.waitForSelector("#email", { timeout: 120000 });
  await p.fill("#email", process.env.B_EMAIL); await p.fill("#mdp", process.env.B_MDP); await p.click("button[type=submit]");
  for (let i = 0; i < 60 && new URL(p.url()).pathname.startsWith("/connexion"); i++) await p.waitForTimeout(1000);
  return !new URL(p.url()).pathname.startsWith("/connexion");
}
async function capturer(p, route, fichier) {
  await p.goto(BASE + route, { timeout: 240000, waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  await p.evaluate(() => { document.documentElement.setAttribute("data-theme", localStorage.getItem("lsno-theme")); window.scrollTo(0, 0); });
  // faire défiler pour déclencher les apparitions, puis remonter
  await p.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
  await p.waitForTimeout(800);
  await p.screenshot({ path: fichier, fullPage: true });
}

(async () => {
  const navigateur = await chromium.launch();
  if (mode === "bureau") {
    for (const largeur of [1280, 1440]) for (const theme of ["clair", "sombre"]) {
      const ctx = await navigateur.newContext({ viewport: { width: largeur, height: 900 }, locale: "fr-FR" }); await ctx.addInitScript(init(theme));
      const p = await ctx.newPage(); await p.route(/challenges\.cloudflare\.com/, (r) => r.abort()); const connecte = await connecter(p);
      const dossier = path.join(DOSSIER, "bureau"); fs.mkdirSync(dossier, { recursive: true });
      for (const route of (connecte ? [...PUBLICS, ...MEMBRES] : PUBLICS)) await capturer(p, route, path.join(dossier, nom(route, theme, largeur)));
      await ctx.close();
    }
    console.log("captures bureau dans", path.join(DOSSIER, "bureau")); await navigateur.close(); return;
  }
  const dossier = path.join(DOSSIER, mode === "ref" ? "mobile-ref" : "mobile-apres"); fs.mkdirSync(dossier, { recursive: true });
  for (const theme of ["clair", "sombre"]) {
    const ctx = await navigateur.newContext({ ...devices["Pixel 7"], locale: "fr-FR" }); await ctx.addInitScript(init(theme));
    const p = await ctx.newPage(); await p.route(/challenges\.cloudflare\.com/, (r) => r.abort()); const connecte = await connecter(p);
    for (const route of (connecte ? [...new Set([...PUBLICS, ...MEMBRES])] : PUBLICS)) await capturer(p, route, path.join(dossier, nom(route, theme)));
    await ctx.close();
  }
  await navigateur.close();
  console.log(mode === "ref" ? "références mobiles dans " + dossier : "captures « après » dans " + dossier + " — lancer : python outils/bureau-diff.py");
})().catch((e) => { console.error("ÉCHEC", String(e).slice(0, 300)); process.exit(1); });
