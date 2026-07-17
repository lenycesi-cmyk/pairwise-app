import { useEffect } from "react";
import { useTranslation } from "../hooks/useTranslation";

// Fenêtre de discussion dédiée (feuille modale). Affiche UNIQUEMENT le fil de
// commentaires d'une transaction ou d'un actif — pas l'écran d'édition complet.
// Le contenu (TransactionComments / AssetComments en mode `bare`) est passé en
// enfant par l'appelant.
export default function CommentsModal({ title, onClose, children }) {
  const t = useTranslation();

  // Fermeture au clavier (Échap).
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="pw-dialog-backdrop"
      style={{
        position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "0 12px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="pw-dialog-panel"
        style={{
          background: "var(--bg)", width: "100%", maxWidth: 520, maxHeight: "85vh",
          borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column",
          overflow: "hidden", boxShadow: "var(--shadow-lg)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.9rem 1.1rem", borderBottom: "0.5px solid var(--rule)" }}>
          <span
            className="pw-chip"
            style={{ width: 30, height: 30, borderRadius: 9, background: "var(--sky-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >
            <i className="ti ti-message-circle" style={{ fontSize: 16, color: "var(--sky)" }} aria-hidden="true" />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 11, color: "var(--ink-3)" }}>{t("tx_comments")}</p>
            <h2 style={{ fontSize: 15, margin: 0, fontFamily: "var(--font-display)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={t("common_close")}
            style={{
              width: 32, height: 32, borderRadius: 99, flexShrink: 0,
              background: "color-mix(in srgb, var(--ink) 6%, transparent)", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}
          >
            <i className="ti ti-x" style={{ fontSize: 17 }} aria-hidden="true" />
          </button>
        </div>
        <div style={{ padding: "1rem 1.1rem", overflowY: "auto" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
