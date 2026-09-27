// Les erreurs dites aux membres : jamais le texte brut du navigateur ou de
// la base (« TypeError: Failed to fetch », « JWT expired »), une phrase qui
// dit ce qui se passe et quoi faire. Le détail part dans la console, pour nous.
// Les messages écrits par nous côté base (« Réservé aux membres validés. »)
// sont en français et courts : on les laisse passer tels quels.

export function estReseau(e) {
  const m = String(e?.message ?? e ?? "");
  return /failed to fetch|fetch failed|networkerror|network request failed|load failed|err_|timed? ?out|aborted|réseau/i.test(m)
    || (e?.name === "TypeError" && /fetch/i.test(m));
}

const FRANCAIS = /^[A-ZÀ-ÿ«][^{}<>]{3,160}$/;
const ANGLAIS = /\b(error|exception|undefined|null|failed|invalid|denied|violates|constraint|relation|column|function|syntax|token|jwt|permission|row-level|policy)\b/i;

export function texteErreur(e, secours = "réessaie dans un instant.") {
  if (e) console.warn("[LSNO] erreur :", e);
  const m = String(e?.message ?? e ?? "").trim();
  if (estReseau(e)) return "la connexion a lâché. Vérifie le réseau et réessaie.";
  if (/jwt|expired|not authenticated|session|refresh_token|401/i.test(m)) return "ta session a expiré : reconnecte-toi.";
  if (/row-level security|permission denied|403|not allowed/i.test(m)) return "tu n’as pas le droit de faire ça.";
  if (/duplicate key|23505/i.test(m)) return "c’est déjà fait.";
  if (/too large|payload|413|exceeded the maximum/i.test(m)) return "le fichier est trop lourd.";
  if (FRANCAIS.test(m) && /[àâçéèêîôû’]|\bne\b|\bpas\b|\bdes\b|\bles\b/i.test(m) && !ANGLAIS.test(m)) return m;
  return secours;
}

// relance une lecture qui échoue sur le réseau (deux essais, puis on abandonne)
export async function avecReprise(fn, { essais = 2, delai = 900 } = {}) {
  let derniere;
  for (let i = 0; i < essais; i++) {
    try { return await fn(); }
    catch (e) {
      derniere = e;
      if (!estReseau(e) || i === essais - 1) throw e;
      await new Promise((r) => setTimeout(r, delai * (i + 1)));
    }
  }
  throw derniere;
}
