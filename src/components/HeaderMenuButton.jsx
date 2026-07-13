import { useTranslation } from "../hooks/useTranslation";

// Bouton ☰ du sticky header (mobile) : ouvre le tiroir de navigation plein
// écran (les 6 onglets + Réglages). Sur desktop, le rail latéral est permanent,
// donc ce bouton est masqué (voir .nav-menu-btn dans styles/layout.css).
// Même style que les boutons ronds d'action du header (devise, crayon).
export default function HeaderMenuButton({ onClick, innerRef }) {
  const t = useTranslation();
  return (
    <button
      ref={innerRef}
      onClick={onClick}
      aria-label={t("nav_menu")}
      className="nav-menu-btn"
      style={{
        width: 30, height: 30, borderRadius: "50%", background: "var(--bg-card)",
        border: "0.5px solid var(--rule)", display: "flex", alignItems: "center",
        justifyContent: "center", flexShrink: 0,
      }}
    >
      <i className="ti ti-menu-2" style={{ fontSize: 16 }} aria-hidden="true" />
    </button>
  );
}
