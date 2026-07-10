import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/layout.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Enregistre le Service Worker au chargement pour que l'app se relance hors
// connexion (cache d'app-shell). Le même SW gère aussi les notifications FCM ;
// usePushNotifications réutilise ensuite cet enregistrement.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/firebase-messaging-sw.js").catch(() => {})
  })
}
