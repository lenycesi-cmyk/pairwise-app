import { useAuth } from "../context/AuthContext";

// One-time contextual tip shown the first time a user opens a given tab,
// dismissible or auto-marked-seen. Per-user (not per-couple) via
// users/{uid}.seenHints, so each member gets their own first-visit tour
// regardless of what their partner has already dismissed.
export default function TabHint({ tabKey, children }) {
  const { seenHints, markHintSeen } = useAuth();
  if (seenHints[tabKey]) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        background: "var(--sky-light)",
        border: "0.5px solid var(--sky)",
        borderRadius: "var(--radius-lg)",
        padding: "12px 14px",
        marginBottom: 16,
      }}
    >
      <i className="ti ti-bulb" style={{ fontSize: 16, color: "var(--sky)", flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
      <p style={{ fontSize: 13, color: "var(--sky)", flex: 1, lineHeight: 1.4 }}>{children}</p>
      <button
        onClick={() => markHintSeen(tabKey)}
        aria-label="Fermer"
        style={{ background: "none", border: "none", color: "var(--sky)", flexShrink: 0 }}
      >
        <i className="ti ti-x" style={{ fontSize: 14 }} aria-hidden="true" />
      </button>
    </div>
  );
}
