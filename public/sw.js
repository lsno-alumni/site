// Service worker — les notifications push, une page « hors ligne », et le
// cache des MÉDIAS des messages et du fil.
// Aucune page ni donnée n'est mise en cache (la fraîcheur reste au serveur et
// à la mémoire d'onglet). En revanche les fichiers qui ne changent JAMAIS une
// fois envoyés — photos, vidéos et vocaux des messages (bucket « pieces »),
// photos et vidéos du fil et des moments (bucket « medias ») — sont gardés ici
// une fois reçus : une conversation déjà ouverte se relit sans réseau, et une
// adresse signée qui change ne force plus un nouveau téléchargement (la clé du
// cache ignore le jeton). Plafond : MAX_MEDIAS fichiers, les plus anciens partent.

const CACHE_HORS_LIGNE = "lsno-hors-ligne-v1";
const PAGE_HORS_LIGNE = "/hors-ligne.html";
const CACHE_MEDIAS = "lsno-medias-v1";
const MAX_MEDIAS = 300;
const estMedia = (url) => /\/storage\/v1\/object\/(sign\/pieces|public\/medias)\//.test(url.pathname);

async function servirMedia(requete) {
  const url = new URL(requete.url);
  const cle = url.origin + url.pathname;          // sans le jeton de signature
  const cache = await caches.open(CACHE_MEDIAS);
  const connu = await cache.match(cle);
  if (connu) return connu;
  // en CORS pour obtenir une réponse lisible (donc stockable sans gonfler le
  // quota) ; Supabase Storage autorise toutes les origines
  let reponse;
  try { reponse = await fetch(requete.url, { mode: "cors", credentials: "omit" }); }
  catch { return fetch(requete); }
  if (reponse.ok && /^(image|video|audio)\//.test(reponse.headers.get("content-type") || "")) {
    cache.put(cle, reponse.clone()).then(async () => {
      const cles = await cache.keys();
      for (const k of cles.slice(0, Math.max(0, cles.length - MAX_MEDIAS))) await cache.delete(k);
    }).catch(() => {});
  }
  return reponse;
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_HORS_LIGNE)
      .then((c) => c.addAll([PAGE_HORS_LIGNE, "/img/logo.jpg"]))
      .catch(() => { /* sans réseau à l'installation : la page viendra à la prochaine */ })
  );
  self.skipWaiting();
});

// Navigations uniquement (l'ouverture d'une page) : on laisse passer la
// requête telle quelle, et si le réseau échoue, on répond la page hors ligne.
// Les autres requêtes (données, images, scripts) ne sont pas touchées.
self.addEventListener("fetch", (e) => {
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match(PAGE_HORS_LIGNE)));
    return;
  }
  // le blason de la page hors ligne : réseau d'abord, cache seulement s'il échoue
  if (new URL(e.request.url).pathname === "/img/logo.jpg") {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  // médias immuables des messages et du fil : cache d'abord
  if (e.request.method === "GET" && estMedia(new URL(e.request.url))) {
    e.respondWith(servirMedia(e.request));
  }
});
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// ------------------------------------------------------------
// Regroupement : au-delà d'un certain nombre de notifications NON LUES d'une
// même famille, on les remplace par un résumé (« 4 nouveaux membres ») plutôt
// que de les empiler. En dessous du seuil, chacune reste individuelle : on ne
// perd donc jamais le détail des premières.
//   SEUIL = 4 → les 3 premières s'affichent séparément, la 4e déclenche le résumé.
// Le comptage se fait par appareil, sur ce qui est encore affiché ET reçu dans
// les dernières 24 h : une notification d'il y a trois jours, jamais écartée,
// ne compte plus (sinon une seule arrivée devenait « 4 nouveaux membres »).
// Un envoi marqué « seul » (annonce de rentrée) n'est jamais regroupé.
// ------------------------------------------------------------
const SEUIL_REGROUPEMENT = 4;
const FENETRE_MS = 24 * 3600 * 1000;
const RESUMES = {
  reseau: {
    titre: (n) => `${n} nouveaux membres aujourd'hui`,
    corps: "Ils ont rejoint le réseau ces dernières 24 heures.",
    url: "/annuaire",
  },
  offres: {
    titre: (n) => `${n} nouvelles opportunités aujourd'hui`,
    corps: "Partagées ces dernières 24 heures.",
    url: "/offres",
  },
  fil: {
    titre: (n) => `${n} nouveautés dans le fil`,
    corps: "Publications et discussions des dernières 24 heures.",
    url: "/fil",
  },
};
const recente = (n) => Date.now() - (n.data?.recu ?? 0) < FENETRE_MS;

async function afficher(d) {
  const commun = {
    icon: "/icone-192.png",
    // ⚠ Android n'utilise QUE la transparence de l'icône de barre d'état :
    // une image à fond plein y apparaît en carré blanc. D'où ce fichier dédié.
    badge: "/badge-notif.png",
  };
  const famille = d.famille;
  const resume = d.seul ? null : RESUMES[famille];

  // familles non regroupées (mes demandes, annonces, messages) : une
  // notification = une alerte. Avec un « groupe » (conversation, publication),
  // la nouvelle REMPLACE la précédente du même groupe et fait revibrer.
  if (!resume) {
    // message supprimé : on referme ce qui est affiché pour cette conversation
    if (d.fermer && d.groupe) {
      const ouvertes = await self.registration.getNotifications({ tag: d.groupe });
      ouvertes.forEach((n) => n.close());
      return;
    }
    // message modifié : remplacée sans bruit, et seulement si elle est encore affichée
    if (d.silencieux && d.groupe) {
      const ouvertes = await self.registration.getNotifications({ tag: d.groupe });
      if (!ouvertes.length) return;
    }
    // messages : rien à afficher si la conversation est déjà ouverte et
    // visible à l'écran — la bulle arrive en temps réel, une notification
    // par-dessus ferait doublon
    if (famille === "messages" && d.url) {
      const fenetres = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const ouverte = fenetres.some((f) => f.visibilityState === "visible" && new URL(f.url).pathname === d.url);
      if (ouverte) return;
    }
    return self.registration.showNotification(d.titre || "LSNO Amicale", {
      ...commun,
      body: d.corps || "",
      tag: d.groupe || undefined,
      renotify: Boolean(d.groupe) && !d.silencieux,
      silent: Boolean(d.silencieux),
      data: { url: d.url || "/" },
    });
  }

  const affichees = await self.registration.getNotifications();
  const cleResume = `${famille}-resume`;
  const dejaResume = affichees.find((n) => n.tag === cleResume && recente(n));
  // seules les individuelles RÉCENTES comptent ; les anciennes restent affichées telles quelles
  const individuelles = affichees.filter(
    (n) => n.tag && n.tag.startsWith(`${famille}-`) && n.tag !== cleResume && recente(n)
  );
  const maintenant = Date.now();

  // un résumé récent existe déjà : on l'incrémente
  if (dejaResume) {
    const n = (dejaResume.data?.compte ?? SEUIL_REGROUPEMENT) + 1;
    dejaResume.close();
    return self.registration.showNotification(resume.titre(n), {
      ...commun, body: resume.corps, tag: cleResume, renotify: true,
      data: { url: resume.url, compte: n, recu: maintenant },
    });
  }

  // sous le seuil : notification individuelle (étiquette unique, datée)
  if (individuelles.length + 1 < SEUIL_REGROUPEMENT) {
    return self.registration.showNotification(d.titre || "LSNO Amicale", {
      ...commun,
      body: d.corps || "",
      tag: `${famille}-${maintenant}`,
      data: { url: d.url || "/", recu: maintenant },
    });
  }

  // seuil atteint dans la journée : les individuelles récentes cèdent la place à un résumé
  const n = individuelles.length + 1;
  individuelles.forEach((x) => x.close());
  return self.registration.showNotification(resume.titre(n), {
    ...commun, body: resume.corps, tag: cleResume, renotify: true,
    data: { url: resume.url, compte: n, recu: maintenant },
  });
}

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { titre: "LSNO Amicale" }; }
  e.waitUntil(afficher(d));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const cible = e.notification.data?.url || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      // si l'appli est déjà ouverte : on la met au premier plan et on navigue
      for (const f of fenetres) {
        if ("focus" in f) { f.navigate?.(cible); return f.focus(); }
      }
      return self.clients.openWindow(cible);
    })
  );
});
