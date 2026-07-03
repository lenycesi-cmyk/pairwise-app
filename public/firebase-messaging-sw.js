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
