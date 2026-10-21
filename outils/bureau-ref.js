// Garantie « le mobile ne bouge pas » du chantier bureau (21/10).
//   node outils/bureau-ref.js ref       → photos de référence des écrans mobiles (Pixel 7, 2 thèmes)
//   node outils/bureau-ref.js apres     → mêmes photos après modification ; puis  python outils/bureau-diff.py  compare pixel par pixel
//   node outils/bureau-ref.js bureau    → captures grand écran (1280 et 1440) pour relecture
// Écrans publics seulement sans identifiants ; avec B_EMAIL/B_MDP (captcha coupé), les écrans membres aussi.
const { chromium, devices } = require("playwright");
const fs = require("fs"); const path = require("path");
const BASE = process.env.BASE || "http://localhost:3007";
const DOSSIER = path.join(__dirname, "..", "..", "bureau-captures");
const PUBLICS = ["/", "/connexion", "/inscription", "/connexion/lien", "/connexion/lien/retour", "/mot-de-passe/oubli", "/mot-de-passe/nouveau", "/bienvenue", "/conditions", "/a-propos"];
// « /profil/* » = la fiche du premier membre de l'annuaire ; « /annuaire#feuille » = l'annuaire avec sa feuille de profil ouverte (photo de la fenêtre seule)
const MEMBRES = ["/", "/annuaire", "/fil", "/offres", "/messages", "/mon-profil", "/conseils", "/questions", "/evenements", "/bibliotheque", "/nouveautes", "/a-propos", "/admin", "/profil/*", "/annuaire#feuille"];
const mode = process.argv[2] || "ref";
const THEMES = (process.env.THEMES || "clair,sombre").split(",");   // THEMES=sombre pour ne refaire qu'un thème
// ROUTES=accueil,mon_profil pour ne refaire que ces écrans (noms des fichiers, sans barre : Git Bash transforme « / » en chemin Windows)
const cle = (route) => (route === "/" ? "accueil" : route.slice(1).replace(/\W+/g, "_").replace(/_$/, ""));
const ROUTES = process.env.ROUTES ? process.env.ROUTES.split(",") : null;
const garder = (liste) => (ROUTES ? liste.filter((r) => ROUTES.includes(cle(r))) : liste);
const nom = (route, theme, largeur) => `${cle(route)}--${theme}${largeur ? "--" + largeur : ""}.png`;

// stabilité des photos : hasard figé (nuage de pays, voisins…) et captcha Turnstile bloqué (il apparaît ou non selon le réseau)
// le hasard n'est figé qu'APRÈS la connexion (page.addInitScript dans les boucles) : figé dès le départ,
// il a fait échouer une connexion sur trois ; et il ne renvoie jamais 1 (Math.random doit rester < 1)
const HASARD_FIGE = `(() => { let g = 123456789; Math.random = () => { g = (g * 1103515245 + 12345) & 0x7fffffff; return g / 2147483648; }; })();`;
const init = (theme) => `
  localStorage.setItem("lsno-theme", "${theme}");
  const poser = () => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important} *,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;caret-color:transparent!important} .np-zone{visibility:hidden!important} .bu-roue-mobile .nb,.cache3d .nb{visibility:hidden!important}";   /* roue 3D : ses compteurs ne s'animent que quand la carte passe devant → masqués eux aussi */   /* le nuage de pays bouge en continu (animation physique) : masqué, son cadre reste mesuré */ (document.head || document.documentElement).appendChild(s); };
  if (document.head) poser(); else document.addEventListener("DOMContentLoaded", poser);`;

async function connecter(p) {
  if (!process.env.B_EMAIL) return false;
  await p.goto(BASE + "/connexion", { timeout: 240000, waitUntil: "domcontentloaded" }); await p.waitForSelector("#email", { timeout: 120000 });
  // le widget anti-robot échoue parfois à se charger (« La vérification n'aboutit pas… recharge la page ») :
  // on suit le conseil, on recharge et on recommence, trois fois au plus
  for (let essai = 0; essai < 3 && new URL(p.url()).pathname.startsWith("/connexion"); essai++) {
    if (essai) { await p.reload({ waitUntil: "domcontentloaded" }); await p.waitForSelector("#email", { timeout: 120000 }); }
    // cliquer avant que la page soit active envoie le formulaire « à l'ancienne » et rien ne se passe : on attend le calme
    try { await p.waitForLoadState("networkidle", { timeout: 20000 }); } catch { /* on continue */ }
    await p.waitForTimeout(800);
    await p.fill("#email", process.env.B_EMAIL); await p.fill("#mdp", process.env.B_MDP);
    try { await p.waitForSelector("button[type=submit]:not([disabled])", { timeout: 25000 }); } catch { /* on clique quand même */ }
    await p.click("button[type=submit]");
    for (let i = 0; i < 15 && new URL(p.url()).pathname.startsWith("/connexion"); i++) await p.waitForTimeout(1000);
  }
  const ok = !new URL(p.url()).pathname.startsWith("/connexion");
  if (!ok) console.log("   (connexion : page restée sur", new URL(p.url()).pathname, "| message :", (await p.locator("[role=alert]").allTextContents()).join(" ").slice(0, 160) || "aucun", ")");
  return ok;
}
async function premierProfil(p) {
  await p.goto(BASE + "/annuaire", { timeout: 240000, waitUntil: "domcontentloaded" }); await p.waitForSelector(".fiche", { timeout: 60000 });
  return p.locator(".fiche").first().getAttribute("href");
}
async function capturer(p, route, fichier) {
  let fenetreSeule = false;
  if (route === "/profil/*") route = await premierProfil(p);
  if (route === "/annuaire#feuille") {
    await p.goto(BASE + "/annuaire", { timeout: 240000, waitUntil: "domcontentloaded" }); await p.waitForSelector(".fiche", { timeout: 60000 });
    try { await p.waitForLoadState("networkidle", { timeout: 15000 }); } catch { /* on continue */ }
    await p.evaluate(() => { document.documentElement.setAttribute("data-theme", localStorage.getItem("lsno-theme")); });
    await p.locator(".fiche").first().click(); await p.waitForSelector(".fg-feuille", { timeout: 60000 }); await p.waitForTimeout(2500);
    await p.screenshot({ path: fichier, fullPage: false });   // la feuille est fixe : la fenêtre seule
    return;
  }
  await p.goto(BASE + route, { timeout: 240000, waitUntil: "domcontentloaded" });
  try { await p.waitForLoadState("networkidle", { timeout: 15000 }); } catch { /* flux temps réel : on n'attend pas plus */ }
  await p.waitForTimeout(2500);   // compteurs (figés par reducedMotion), chiffres chargés après coup
  await p.evaluate(() => { document.documentElement.setAttribute("data-theme", localStorage.getItem("lsno-theme")); window.scrollTo(0, 0); });
  // faire défiler pour déclencher les apparitions, puis remonter
  await p.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo({ top: y, behavior: "instant" }); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo({ top: 0, behavior: "instant" }); document.querySelectorAll("*").forEach((el) => { if (el.scrollLeft) el.scrollLeft = 0; }); });   // les bandeaux de chapitres (Conditions, Mon profil) suivent le défilement : on les ramène au début   // « instant » : avec le défilement doux, 60 ms ne suffisaient pas et les sections du bas restaient invisibles en grand écran
  await p.waitForTimeout(1500);
  // les bandeaux de chapitres se recentrent en douceur après coup : remis au début juste avant la photo
  await p.evaluate(() => document.querySelectorAll("*").forEach((el) => { if (el.scrollLeft) el.scrollLeft = 0; }));
  await p.waitForTimeout(200);
  await p.screenshot({ path: fichier, fullPage: true });
}

(async () => {
  const navigateur = await chromium.launch();
  if (mode === "bureau") {
    for (const largeur of [1280, 1440]) for (const theme of THEMES) {
      const ctx = await navigateur.newContext({ viewport: { width: largeur, height: 900 }, locale: "fr-FR", reducedMotion: "reduce" }); await ctx.addInitScript(init(theme));
      const p = await ctx.newPage(); const connecte = await connecter(p); await p.route(/challenges\.cloudflare\.com/, (r) => r.abort()); await p.addInitScript(HASARD_FIGE);
      const dossier = path.join(DOSSIER, "bureau"); fs.mkdirSync(dossier, { recursive: true });
      for (const route of garder(connecte ? [...PUBLICS, ...MEMBRES] : PUBLICS)) await capturer(p, route, path.join(dossier, nom(route, theme, largeur)));
      await ctx.close();
    }
    console.log("captures bureau dans", path.join(DOSSIER, "bureau")); await navigateur.close(); return;
  }
  const dossier = path.join(DOSSIER, mode === "ref" ? "mobile-ref" : "mobile-apres"); fs.mkdirSync(dossier, { recursive: true });
  for (const theme of THEMES) {
    const ctx = await navigateur.newContext({ ...devices["Pixel 7"], locale: "fr-FR", reducedMotion: "reduce" }); await ctx.addInitScript(init(theme));
    const p = await ctx.newPage();
    // l'accueil public (visiteur) d'abord, sous le nom « accueil_public » ; « accueil » restera l'accueil connecté
    if (process.env.B_EMAIL && garder(["/"]).length) await capturer(p, "/", path.join(dossier, nom("/", theme).replace("accueil--", "accueil_public--")));
    const connecte = await connecter(p);   // connexion AVANT de bloquer le widget et de figer le hasard
    await p.route(/challenges\.cloudflare\.com/, (r) => r.abort()); await p.addInitScript(HASARD_FIGE);
    if (process.env.B_EMAIL && !connecte) console.log("⚠ connexion impossible pour le thème", theme, "— écrans membres non capturés");
    for (const route of garder(connecte ? [...new Set([...PUBLICS, ...MEMBRES])] : PUBLICS)) await capturer(p, route, path.join(dossier, nom(route, theme)));
    await ctx.close();
  }
  await navigateur.close();
  console.log(mode === "ref" ? "références mobiles dans " + dossier : "captures « après » dans " + dossier + " — lancer : python outils/bureau-diff.py");
})().catch((e) => { console.error("ÉCHEC", String(e).slice(0, 300)); process.exit(1); });
