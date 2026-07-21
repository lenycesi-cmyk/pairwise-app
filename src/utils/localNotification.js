// Affiche une notification locale sans jamais faire planter l'app.
//
// Sur Android (Chrome/mobile), le constructeur `new Notification()` est
// INTERDIT et lève « Failed to construct 'Notification': Illegal constructor.
// Use ServiceWorkerRegistration.showNotification() instead. » — une exception
// non gérée dans un runner suffisait à démonter tout l'arbre React (écran
// blanc). On passe donc par le Service Worker en priorité (compatible mobile),
// avec repli sur le constructeur pour les navigateurs desktop où il est permis,
// le tout protégé pour qu'une notif ne casse jamais l'application.
export function showLocalNotification(title, options = {}) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if ("serviceWorker" in navigator && navigator.serviceWorker?.ready) {
      navigator.serviceWorker.ready
        .then((reg) => reg.showNotification(title, options))
        .catch(() => {
          try { new Notification(title, options); } catch { /* ignore */ }
        });
      return;
    }
    new Notification(title, options);
  } catch {
    // Une notification ne doit jamais crasher l'app.
  }
}
