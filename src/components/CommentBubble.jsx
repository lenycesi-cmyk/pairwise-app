// Petite bulle « discussion » affichée sur une ligne (transaction / actif) qui
// porte au moins un commentaire. Clic → ouvre la fenêtre de discussion (et non
// l'écran d'édition). Stoppe la propagation pour ne pas déclencher le clic de
// la ligne parente.
export default function CommentBubble({ count = 0, onClick, label = "Discussion" }) {
  return (
    <button
      className="pw-pop-spring"
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      aria-label={label}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0,
        height: 24, padding: "0 8px", borderRadius: 99,
        border: "0.5px solid var(--rule)", background: "var(--bg-card)",
        color: "var(--ink-2)", fontSize: 11, fontWeight: 600, cursor: "pointer",
      }}
    >
      <i className="ti ti-message-circle" style={{ fontSize: 13, color: "var(--sky)" }} aria-hidden="true" />
      {count > 0 && <span className="pw-num">{count}</span>}
    </button>
  );
}
