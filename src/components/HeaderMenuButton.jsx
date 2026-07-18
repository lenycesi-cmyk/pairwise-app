import { useTranslation } from "../hooks/useTranslation";

// Bouton ☰ du sticky header (mobile) : ouvre le tiroir de navigation plein
// écran (les 6 onglets + Réglages). Sur desktop, le rail latéral est permanent,
// donc ce bouton est masqué (voir .nav-menu-btn dans styles/layout.css).
// Fond orange plein (même couleur que le bouton « Ajouter »/FAB, var(--tang))
// avec icône blanche, pour le distinguer comme point d'entrée de la navigation.
export default function HeaderMenuButton({ onClick, innerRef }) {
  const t = useTranslation();
  return (
    <button
      ref={innerRef}
      onClick={onClick}
      aria-label={t("nav_menu")}
      className="nav-menu-btn"
      style={{
        width: 30, height: 30, borderRadius: "50%", background: "var(--tang)",
        border: "none", display: "flex", alignItems: "center",
        justifyContent: "center", flexShrink: 0,
      }}
    >
      <i className="ti ti-menu-2" style={{ fontSize: 16, color: "#fff" }} aria-hidden="true" />
    </button>
  );
}
