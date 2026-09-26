// Service worker — les notifications push, et une page « hors ligne ».
// ⚠ Aucune page ni donnée du site n'est mise en cache : la fraîcheur reste
// intacte (décision « pas de cache client »). Seule la page hors ligne et le
// blason sont gardés, pour répondre quand le réseau MANQUE — et seulement là.

const CACHE_HORS_LIGNE = "lsno-hors-ligne-v1";
const PAGE_HORS_LIGNE = "/hors-ligne.html";

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
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(() => caches.match(PAGE_HORS_LIGNE)));
});
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// ------------------------------------------------------------
// Regroupement : au-delà d'un certain nombre de notifications NON LUES d'une
// même famille, on les remplace par un résumé (« 4 nouveaux membres ») plutôt
// que de les empiler. En dessous du seuil, chacune reste individuelle : on ne
// perd donc jamais le détail des premières.
//   SEUIL = 4 → les 3 premières s'affichent séparément, la 4e déclenche le résumé.
// Le comptage se fait par appareil, sur ce qui est encore affiché : lire ou
// écarter les notifications remet le compteur à zéro (c'est voulu).
// ------------------------------------------------------------
const SEUIL_REGROUPEMENT = 4;
const RESUMES = {
  reseau: {
    titre: (n) => `${n} nouveaux membres`,
    corps: "Ils viennent de rejoindre le réseau.",
    url: "/annuaire",
  },
  offres: {
    titre: (n) => `${n} nouvelles opportunités`,
    corps: "Elles viennent d'être partagées.",
    url: "/offres",
  },
};

async function afficher(d) {
  const commun = {
    icon: "/icone-192.png",
    // ⚠ Android n'utilise QUE la transparence de l'icône de barre d'état :
    // une image à fond plein y apparaît en carré blanc. D'où ce fichier dédié.
    badge: "/badge-notif.png",
  };
  const famille = d.famille;
  const resume = RESUMES[famille];

  // familles non regroupées (mes demandes, annonces) : une notification = une alerte
  if (!resume) {
    return self.registration.showNotification(d.titre || "LSNO Amicale", {
      ...commun,
      body: d.corps || "",
      tag: d.groupe || undefined,
      data: { url: d.url || "/" },
    });
  }

  const affichees = await self.registration.getNotifications();
  const cleResume = `${famille}-resume`;
  const dejaResume = affichees.find((n) => n.tag === cleResume);
  const individuelles = affichees.filter(
    (n) => n.tag && n.tag.startsWith(`${famille}-`) && n.tag !== cleResume
  );

  // un résumé existe déjà : on l'incrémente
  if (dejaResume) {
    const n = (dejaResume.data?.compte ?? SEUIL_REGROUPEMENT) + 1;
    dejaResume.close();
    return self.registration.showNotification(resume.titre(n), {
      ...commun, body: resume.corps, tag: cleResume, renotify: true,
      data: { url: resume.url, compte: n },
    });
  }

  // sous le seuil : notification individuelle (étiquette unique)
  if (individuelles.length + 1 < SEUIL_REGROUPEMENT) {
    return self.registration.showNotification(d.titre || "LSNO Amicale", {
      ...commun,
      body: d.corps || "",
      tag: `${famille}-${Date.now()}`,
      data: { url: d.url || "/" },
    });
  }

  // seuil atteint : les individuelles cèdent la place à un résumé
  const n = individuelles.length + 1;
  individuelles.forEach((x) => x.close());
  return self.registration.showNotification(resume.titre(n), {
    ...commun, body: resume.corps, tag: cleResume, renotify: true,
    data: { url: resume.url, compte: n },
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
