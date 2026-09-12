// Régénère la liste complète des pays (src/lib/donnees.js, bloc LISTE_PAYS)
// et copie leurs drapeaux dans public/img/drapeaux/.
//
// Source : les codes 2 lettres du paquet `flag-icons` (dev dependency,
// jamais chargé par l'app — sert seulement à fournir les SVG et la liste des
// codes), filtrés aux vrais pays/territoires reconnus par Intl.DisplayNames
// (exclut les organisations comme EU/UN, les sous-régions type gb-eng, et
// le drapeau de secours « xx » du paquet lui-même).
//
// À relancer si `flag-icons` est mis à jour (nouveaux pays/codes).
//   node outils/gen_liste_pays.js
const fs = require("fs");
const path = require("path");

const RACINE = path.join(__dirname, "..");
const SRC_DRAPEAUX = path.join(RACINE, "node_modules/flag-icons/flags/4x3");
const DEST_DRAPEAUX = path.join(RACINE, "public/img/drapeaux");
const EXCLUS = new Set(["EU", "UN"]); // organisations, pas des pays de résidence

const noms = new Intl.DisplayNames(["fr"], { type: "region" });
const fichiers = fs.readdirSync(SRC_DRAPEAUX).map((f) => f.replace(".svg", ""));

const valides = [];
for (const c of fichiers) {
  if (!/^[a-z]{2}$/.test(c)) continue; // exclut gb-eng, es-ct, sh-ac…
  const code = c.toUpperCase();
  if (EXCLUS.has(code)) continue;
  let nom;
  try { nom = noms.of(code); } catch { nom = null; }
  if (!nom || nom === code) continue; // pas un vrai pays reconnu (pc, xx…)
  valides.push([code, nom]);
}
valides.sort((a, b) => a[1].localeCompare(b[1], "fr"));

fs.rmSync(DEST_DRAPEAUX, { recursive: true, force: true });
fs.mkdirSync(DEST_DRAPEAUX, { recursive: true });
for (const [code] of valides) {
  fs.copyFileSync(
    path.join(SRC_DRAPEAUX, `${code.toLowerCase()}.svg`),
    path.join(DEST_DRAPEAUX, `${code.toLowerCase()}.svg`)
  );
}

const bloc =
  "export const LISTE_PAYS = [\n" +
  valides.map(([c, n]) => `  ["${c}", ${JSON.stringify(n)}],`).join("\n") +
  "\n];\n";
fs.writeFileSync(path.join(RACINE, "outils/liste_pays_generee.txt"), bloc);

console.log(`${valides.length} pays — drapeaux copiés dans public/img/drapeaux/, bloc LISTE_PAYS écrit dans outils/liste_pays_generee.txt`);
