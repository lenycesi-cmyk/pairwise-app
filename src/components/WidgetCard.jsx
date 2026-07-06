// Carte de widget façon brand kit : le titre vit DANS la carte, précédé d'une
// pastille d'icône teintée (qui se remplit au survol via .pw-chip-host), avec
// une action optionnelle à droite ("Voir tout", pills de période...).
// `flush` retire le padding horizontal du contenu (listes bord à bord).
// Partagé par Dashboard / Reports / Wealth pour une UI homogène.
const WIDGET_ACCENTS = {
  coral: ["var(--tang)", "var(--tang-light)"],
  ocean: ["var(--lavi)", "var(--lavi-light)"],
  sky: ["var(--sky)", "var(--sky-light)"],
  amber: ["var(--amber)", "var(--amber-light)"],
  mint: ["var(--sage)", "var(--sage-light)"],
  pink: ["var(--blush)", "var(--blush-light)"],
};

export default function WidgetCard({ icon, accent = "coral", title, action, flush = false, style, children }) {
  const [color, light] = WIDGET_ACCENTS[accent] || WIDGET_ACCENTS.coral;
  return (
    <div
      className="pw-card pw-chip-host"
      data-accent={accent}
      style={{ background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "0.5px solid var(--rule)", overflow: "hidden", ...style }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px 0" }}>
        <span className="pw-chip" style={{ width: 32, height: 32, borderRadius: 10, background: light, "--pw-chip": color, flexShrink: 0 }}>
          <i className={`ti ${icon}`} style={{ fontSize: 16, color }} aria-hidden="true" />
        </span>
        <span style={{ fontSize: 13.5, fontWeight: 600, fontFamily: "var(--font-display)", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {title}
        </span>
        {action}
      </div>
      <div style={{ padding: flush ? "10px 0 6px" : "12px 18px 16px" }}>{children}</div>
    </div>
  );
}
