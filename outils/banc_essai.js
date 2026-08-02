// Banc d'essai : rejoue schema.sql puis TOUTES les migrations sur un PostgreSQL
// jetable, en mémoire, pour attraper AVANT la production ce que l'analyseur de
// syntaxe ne voit pas — une colonne inexistante, une fonction manquante, un ordre
// d'évaluation hasardeux, une politique qui référence ce qui n'existe pas encore.
//
// Pourquoi il existe : le 01/08, trois migrations ont été livrées avec une erreur
// que l'utilisateur a découverte en production, et une quatrième a retiré des
// droits sans qu'on s'en aperçoive. La syntaxe seule ne suffit pas.
//
// Ce que le banc NE PEUT PAS juger — voir outils/banc/prelude.sql : le
// comportement réel de l'authentification, les emails, les notifications
// (pg_net est un leurre) et l'exécution des tâches planifiées. Il vérifie que la
// base SE CONSTRUIT, pas qu'elle se comporte comme Supabase.
//
// Usage :  node outils/banc_essai.js        (ou : npm run banc)
// Sort en erreur dès qu'un fichier échoue — c'est ce qui en fait un garde-fou
// utilisable en intégration continue.

const fs = require("node:fs");
const path = require("node:path");

const RACINE = path.join(__dirname, "..");
const DOSSIER = path.join(RACINE, "supabase");

// Découpe un fichier SQL en instructions, en respectant les chaînes et surtout
// les blocs $$ … $$ (une fonction plpgsql contient des points-virgules).
function instructions(sql) {
  const out = [];
  let courant = "";
  let i = 0;
  let marque = null; // délimiteur $…$ en cours
  while (i < sql.length) {
    const reste = sql.slice(i);
    if (!marque) {
      const m = reste.match(/^\$[A-Za-z_]*\$/);
      if (m) { marque = m[0]; courant += m[0]; i += m[0].length; continue; }
      if (reste.startsWith("--")) {
        const fin = sql.indexOf("\n", i);
        const j = fin === -1 ? sql.length : fin;
        courant += sql.slice(i, j); i = j; continue;
      }
      if (sql[i] === "'") {
        const fin = sql.indexOf("'", i + 1);
        const j = fin === -1 ? sql.length : fin + 1;
        courant += sql.slice(i, j); i = j; continue;
      }
      if (sql[i] === ";") { out.push(courant.trim()); courant = ""; i++; continue; }
    } else if (reste.startsWith(marque)) {
      courant += marque; i += marque.length; marque = null; continue;
    }
    courant += sql[i]; i++;
  }
  if (courant.trim()) out.push(courant.trim());
  // ⚠ Une instruction est presque toujours précédée de son bloc de commentaires :
  // filtrer sur « commence par -- » jetterait le SQL avec. On retire donc les
  // lignes de commentaire EN TÊTE, et on ne rejette que ce qui n'a plus rien.
  const commentaireEnTete = /^(?:\s*--[^\n]*\n)+/;
  return out.map((s) => s.replace(commentaireEnTete, "").trim()).filter(Boolean);
}

(async () => {
  let PGlite, pgcrypto;
  try {
    ({ PGlite } = require("@electric-sql/pglite"));
    ({ pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto"));
  } catch {
    console.error("Installer le banc d'abord :  npm install --save-dev @electric-sql/pglite");
    process.exit(1);
  }

  // pgcrypto est fourni par PGlite (crypt / gen_salt, utilisés par le mot de
  // passe temporaire). pg_net, lui, n'existe pas ici : le prélude le remplace
  // par un leurre, et l'instruction « create extension pg_net » est ignorée.
  const ABSENTES = ["pg_net"];
  const db = await PGlite.create({ extensions: { pgcrypto } });
  const fichiers = [
    path.join(__dirname, "banc", "prelude.sql"),
    path.join(DOSSIER, "schema.sql"),
    ...fs.readdirSync(DOSSIER)
      .filter((f) => /^migration-\d+.*\.sql$/.test(f))
      .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
      .map((f) => path.join(DOSSIER, f)),
  ];

  let echecs = 0;
  let ignorees = 0;
  for (const f of fichiers) {
    const nom = path.basename(f);
    const liste = instructions(fs.readFileSync(f, "utf8"));
    let ko = null;
    for (const inst of liste) {
      const ext = inst.match(/^create\s+extension\s+(?:if\s+not\s+exists\s+)?"?([a-z_]+)/i);
      if (ext && ABSENTES.includes(ext[1])) { ignorees++; continue; }
      try {
        await db.exec(inst);
      } catch (e) {
        ko = { inst, message: String(e.message ?? e).split("\n")[0] };
        break; // la suite dépend presque toujours de ce qui vient d'échouer
      }
    }
    if (ko) {
      echecs++;
      console.log(`\n  ÉCHEC  ${nom}`);
      console.log(`     ${ko.message}`);
      console.log(`     sur : ${ko.inst.replace(/\s+/g, " ").slice(0, 150)}…`);
    } else {
      console.log(`  ok     ${nom}  (${liste.length} instructions)`);
    }
  }

  // état obtenu, utile pour vérifier que la base s'est bien construite
  const compte = async (q) => (await db.query(q)).rows[0].n;
  console.log("\n  Base obtenue :");
  console.log("    tables      :", await compte("select count(*)::int n from pg_tables where schemaname='public'"));
  console.log("    politiques  :", await compte("select count(*)::int n from pg_policies where schemaname='public'"));
  console.log("    fonctions   :", await compte("select count(*)::int n from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public'"));
  console.log("    déclencheurs:", await compte("select count(*)::int n from pg_trigger where not tgisinternal"));
  console.log("    tâches      :", await compte("select count(*)::int n from cron.job"));

  // La vue de contrôle de santé est notre filet de sécurité : on vérifie ici
  // qu'elle S'EXÉCUTE. Ses verdicts, eux, ne veulent rien dire sur le banc —
  // il n'y a ni secrets au Vault, ni vraies tâches planifiées, ni données.
  if (!echecs) {
    try {
      const r = await db.query("select count(*)::int n from sante_systeme");
      console.log(`\n  Contrôle de santé : la vue répond (${r.rows[0].n} lignes de contrôle).`);
    } catch (e) {
      echecs++;
      console.log("\n  ÉCHEC  la vue sante_systeme ne s'exécute pas");
      console.log(`     ${String(e.message ?? e).split("\n")[0]}`);
    }
  }

  console.log(`\n${fichiers.length} fichier(s) rejoué(s), ${echecs} en échec.`);
  process.exit(echecs ? 1 : 0);
})();
