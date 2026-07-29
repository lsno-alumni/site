// Service worker — UNIQUEMENT les notifications push.
// ⚠ Aucune mise en cache volontairement : mettre les pages en cache ici
// créerait des problèmes de fraîcheur (voir la décision « pas de cache client »).
// Il ne sert donc qu'à recevoir les push et ouvrir la bonne page au clic.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { titre: "LSNO Amicale" }; }
  const titre = d.titre || "LSNO Amicale";
  e.waitUntil(
    self.registration.showNotification(titre, {
      body: d.corps || "",
      icon: "/icone-192.png",
      // ⚠ Android n'utilise QUE la transparence de l'icône de barre d'état :
      // une image à fond plein y apparaît en carré blanc. D'où ce fichier
      // dédié (silhouette blanche sur fond transparent, blason simplifié).
      badge: "/badge-notif.png",
      // regroupe les notifications d'un même type au lieu de les empiler
      tag: d.groupe || undefined,
      data: { url: d.url || "/" },
    })
  );
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
