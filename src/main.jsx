import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/layout.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

// Retire l'écran de démarrage (voir index.html) une fois que React a peint.
// Deux images d'attente : la première laisse React poser le DOM, la seconde
// laisse le navigateur le peindre — sans quoi on découvrirait un écran vide
// entre la disparition de l'un et l'apparition de l'autre.
const boot = document.getElementById("pw-boot")
if (boot) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    boot.classList.add("pw-gone")
    boot.addEventListener("transitionend", () => boot.remove(), { once: true })
  }))
}

// Enregistre le Service Worker au chargement pour que l'app se relance hors
// connexion (cache d'app-shell). Le même SW gère aussi les notifications FCM ;
// usePushNotifications réutilise ensuite cet enregistrement.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/firebase-messaging-sw.js").catch(() => {})
  })
}
