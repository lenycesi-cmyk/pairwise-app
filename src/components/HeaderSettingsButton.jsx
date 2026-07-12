import { useTranslation } from "../hooks/useTranslation";

// Bouton Réglages intégré dans le sticky header (mobile) — remplace l'ancien
// FAB flottant, pour l'aligner avec les autres boutons de la barre d'en-tête.
// Même style que les boutons ronds d'action (devise, crayon).
export default function HeaderSettingsButton({ onClick, innerRef }) {
  const t = useTranslation();
  return (
    <button
      ref={innerRef}
      onClick={onClick}
      aria-label={t("nav_settings")}
      style={{
        width: 30, height: 30, borderRadius: "50%", background: "var(--bg-card)",
        border: "0.5px solid var(--rule)", display: "flex", alignItems: "center",
        justifyContent: "center", flexShrink: 0,
      }}
    >
      <i className="ti ti-settings" style={{ fontSize: 15 }} aria-hidden="true" />
    </button>
  );
}
