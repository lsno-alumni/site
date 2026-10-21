// Garde statique du chantier bureau : bureau.css ne doit contenir, hors requête de média
// « (min-width: 1024px) », que la règle qui cache les éléments « bu-… ». Tout le reste est
// réservé au grand écran, donc sans effet possible sur le mobile. Branchée dans le banc visuel.
const postcss = require("postcss"); const fs = require("fs"); const path = require("path");
const racine = postcss.parse(fs.readFileSync(path.join(__dirname, "..", "src", "app", "bureau.css"), "utf8"));
const fautes = [];
racine.nodes.forEach((n) => {
  if (n.type === "comment") return;
  if (n.type === "atrule" && n.name === "media") { if (!/min-width:\s*1024px/.test(n.params)) fautes.push(`@media sans min-width 1024 : ${n.params}`); return; }
  if (n.type === "rule") {
    const cache = n.selectors.every((s) => /^\.bu(-[a-z0-9-]+)?$/.test(s.trim())) && n.nodes.length === 1 && n.nodes[0].prop === "display" && n.nodes[0].value === "none";
    const transparent = /^\.bu-[a-z0-9-]+$/.test(n.selector) && n.nodes.length === 1 && n.nodes[0].prop === "display" && n.nodes[0].value === "contents";
    const ok = cache || transparent;
    if (!ok) fautes.push(`règle hors média : ${n.selector}`); return;
  }
  fautes.push(`inattendu : ${n.type} ${n.name || ""}`);
});
if (fautes.length) { console.log("KO  bureau.css touche au mobile :\n  - " + fautes.join("\n  - ")); process.exit(1); }
console.log("OK  bureau.css : rien hors « min-width: 1024px » sauf la règle qui cache les éléments bu-… (et les enveloppes transparentes « display: contents »)");
