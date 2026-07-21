/* global importScripts, firebase, self, clients */
// Service Worker FCM : reçoit les push quand l'app est fermée/en arrière-plan
// et affiche la notification système. Les valeurs de config sont publiques
// (les mêmes que dans src/firebase.js, déjà visibles dans le bundle).
// NB : les Service Workers ne supportent pas les modules ES du SDK v12 —
// on utilise les builds "compat" prévus pour ce contexte.
importScripts("https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDG6BjMCvUsmMhU05pU2Kt2OxPcFUp7HnM",
  authDomain: "pairwise-12df2.firebaseapp.com",
  projectId: "pairwise-12df2",
  storageBucket: "pairwise-12df2.firebasestorage.app",
  messagingSenderId: "970526442007",
  appId: "1:970526442007:web:ff9e439e78cdb72f615252",
});

const messaging = firebase.messaging();

// Les fonctions Cloud envoient des messages "data-only" pour garder la main
// sur l'affichage (titre/corps/tag) quel que soit l'état de l'app.
messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  self.registration.showNotification(d.title || "Pairwise", {
    body: d.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: d.tag || undefined,
    data: { url: d.url || "/" },
  });
});

// ── Cache app-shell (mode hors connexion) ───────────────────────────────────
// Permet de relancer l'app sans réseau. Stratégie : network-first pour les
// navigations (on sert la dernière version en ligne, repli sur l'index en
// cache hors ligne) ; cache-first pour les assets statiques hashés (immuables).
// Les appels Firestore/Storage/API de change ne sont PAS interceptés : ils
// vont au réseau et Firestore gère lui-même son cache hors ligne (IndexedDB).
// Version du cache : à incrémenter pour purger tout l'app-shell précédent lors
// de l'activation (voir handler "activate"). Utile quand un ancien index/chunk
// en cache pourrait provoquer un écran blanc après déploiement.
const CACHE = "pairwise-shell-v2";
const PRECACHE = ["/", "/index.html", "/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Uniquement le même origine (on laisse Firestore/googleapis/er-api au réseau).
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/index.html", copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/index.html")))
    );
    return;
  }

  // Assets statiques : cache d'abord, sinon réseau (et on met en cache au passage).
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});

// Clic sur la notification → focus l'app si elle est ouverte, sinon l'ouvre.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});
