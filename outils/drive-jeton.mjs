// Obtenir, UNE FOIS, le jeton durable (« refresh token ») qui permet au site de déposer les
// documents de la bibliothèque sur le Google Drive de l'association.
//
//   node outils/drive-jeton.mjs <CLIENT_ID> <CLIENT_SECRET>
//
// Le script ouvre une page de connexion Google : se connecter avec le compte de l'association
// (lsno.alumni@gmail.com) et accepter. La portée demandée est « drive.file » : le site ne pourra
// voir et gérer QUE les fichiers qu'il crée lui-même, rien d'autre du Drive. Le jeton s'affiche à
// la fin : le coller dans Vercel (GOOGLE_REFRESH_TOKEN), avec GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
// et DRIVE_DOSSIER_ID (l'identifiant du dossier « Bibliothèque », dans son adresse Drive).
// Voir outils/LISEZMOI-drive.md pour la préparation côté console Google.
import http from "node:http";
import { exec } from "node:child_process";

const [clientId, clientSecret] = process.argv.slice(2);
if (!clientId || !clientSecret) { console.error("Usage : node outils/drive-jeton.mjs <CLIENT_ID> <CLIENT_SECRET>"); process.exit(1); }
const PORT = 8765;
const redirect = `http://localhost:${PORT}/retour`;
const url = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
  client_id: clientId, redirect_uri: redirect, response_type: "code", access_type: "offline", prompt: "consent",
  scope: "https://www.googleapis.com/auth/drive.file",
});

const serveur = http.createServer(async (req, res) => {
  const u = new URL(req.url, redirect);
  if (u.pathname !== "/retour") { res.writeHead(404); res.end(); return; }
  const code = u.searchParams.get("code");
  if (!code) { res.end("Pas de code reçu."); return; }
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirect, grant_type: "authorization_code" }),
  });
  const j = await r.json();
  if (!j.refresh_token) {
    res.end("Google n'a pas renvoyé de jeton durable : " + JSON.stringify(j) + "\nRelance le script (prompt=consent) et accepte à nouveau.");
    console.error("Réponse Google :", j); serveur.close(); return;
  }
  res.setHeader("content-type", "text/plain; charset=utf-8");
  res.end("C'est bon, tu peux fermer cet onglet. Le jeton est affiché dans le terminal.");
  console.log("\nGOOGLE_REFRESH_TOKEN=" + j.refresh_token + "\n");
  console.log("À coller dans Vercel (Settings → Environment Variables, pour Production ET Preview) avec GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET et DRIVE_DOSSIER_ID, puis redéployer.");
  serveur.close();
});
serveur.listen(PORT, () => {
  console.log("Ouvre cette adresse si le navigateur ne s'ouvre pas tout seul :\n" + url + "\n");
  exec(`start "" "${url}"`);
});
