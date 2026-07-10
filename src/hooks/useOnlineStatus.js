import { useState, useEffect } from "react";

// Suit l'état de connexion du navigateur (navigator.onLine + événements
// online/offline). Renvoie `online` (bool) et `justReconnected` (vrai
// brièvement après un retour en ligne, pour afficher une confirmation).
export function useOnlineStatus() {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    function goOnline() {
      setOnline(true);
      setJustReconnected(true);
      const t = setTimeout(() => setJustReconnected(false), 3000);
      return () => clearTimeout(t);
    }
    function goOffline() {
      setOnline(false);
      setJustReconnected(false);
    }
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return { online, justReconnected };
}
