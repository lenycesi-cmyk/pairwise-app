import { useEffect, useState, useRef } from "react";
import { haptic } from "../utils/haptics";

// Checkmark de validation : une pastille à ressort avec un ✓ qui se dessine,
// puis fondu de sortie (~900 ms au total). Version « légère » du moment de
// délice — pour les gestes fréquents (ajout de transaction, d'actif) là où les
// confettis (réservés aux objectifs atteints) seraient de trop.
//
// Monté une seule fois globalement dans App.jsx. Déclenché de partout via
// notifySuccess() (utils/successCheck.js → événement global "pw-success").
// Respecte prefers-reduced-motion (voir index.css : animations neutralisées,
// la pastille apparaît simplement en fondu).
export default function SuccessCheck() {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    function onSuccess() {
      haptic("tap");
      setVisible(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setVisible(false), 1000);
    }
    window.addEventListener("pw-success", onSuccess);
    return () => {
      window.removeEventListener("pw-success", onSuccess);
      clearTimeout(timerRef.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="pw-success-check" role="status" aria-live="polite" aria-label="Enregistré">
      <div className="pw-success-badge pw-pop-spring">
        <svg viewBox="0 0 52 52" width="40" height="40" aria-hidden="true">
          <path
            className="pw-check-path"
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14 27 l8 8 l16 -18"
          />
        </svg>
      </div>
    </div>
  );
}
