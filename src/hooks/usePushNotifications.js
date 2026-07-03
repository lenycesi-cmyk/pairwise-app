import { useState, useEffect } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useFinance } from "../context/FinanceContext";
import { getMemberKey } from "../utils/members";

// Clé VAPID (Web Push certificate, console Firebase → Cloud Messaging).
// Publique par nature — injectée au build comme les autres VITE_*.
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export function pushSupported() {
  return !!VAPID_KEY && "serviceWorker" in navigator && "Notification" in window && "PushManager" in window;
}

// Enregistre l'appareil pour les notifications push FCM :
// permission → Service Worker → token → stocké sur le doc couple
// (fcmTokens.{memberKey}.{token} = timestamp, plusieurs appareils par
// membre). Le SDK messaging est importé dynamiquement pour rester hors du
// bundle initial et ne rien casser sur les navigateurs sans Push API.
export function usePushNotifications() {
  const { user, coupleId } = useAuth();
  const { members } = useFinance();
  // "unsupported" | "default" | "granted" | "denied"
  const [status, setStatus] = useState(() =>
    pushSupported() ? Notification.permission : "unsupported"
  );
  const [busy, setBusy] = useState(false);

  async function registerDevice() {
    if (!pushSupported() || !user || !coupleId) return false;
    const { getMessaging, getToken } = await import("firebase/messaging");
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const token = await getToken(getMessaging(), {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) return false;
    const me = members.find((m) => m.uid === user.uid);
    const myKey = me ? getMemberKey(me) : user.uid;
    await setDoc(
      doc(db, "couples", coupleId),
      { fcmTokens: { [myKey]: { [token]: Date.now() } } },
      { merge: true }
    );
    localStorage.setItem("fcmTokenRegistered", token);
    return true;
  }

  async function enable() {
    if (!pushSupported() || busy) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      setStatus(permission);
      if (permission === "granted") await registerDevice();
    } catch (err) {
      console.error("Push registration failed", err);
    } finally {
      setBusy(false);
    }
  }

  // Si la permission est déjà accordée (appareil déjà enregistré ou
  // permission donnée pour les notifications locales), on rafraîchit le
  // token silencieusement au lancement — les tokens FCM tournent.
  useEffect(() => {
    if (status !== "granted" || !user || !coupleId || members.length === 0) return;
    registerDevice().catch((err) => console.error("Push token refresh failed", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, user?.uid, coupleId, members.length]);

  return { status, busy, enable, supported: pushSupported() };
}
