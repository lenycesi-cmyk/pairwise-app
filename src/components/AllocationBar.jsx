import { ASSET_CLASSES } from "../data/allocationModels";

// Barre empilée d'une allocation (5 classes de risque). Utilisée pour comparer
// visuellement « actuel » et « cible » sur la même échelle, et comme aperçu des
// profils standards dans la modale.
export default function AllocationBar({ weights, height = 8, muted = false, label }) {
  const total = ASSET_CLASSES.reduce((s, c) => s + (weights?.[c.id] || 0), 0);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {label && (
        <span style={{ fontSize: 10, color: "var(--ink-3)", width: 52, flexShrink: 0, textTransform: "uppercase", letterSpacing: 0.3, whiteSpace: "nowrap" }}>
          {label}
        </span>
      )}
      <div
        style={{
          display: "flex", flex: 1, height, borderRadius: height / 2,
          overflow: "hidden", background: "var(--rule)",
        }}
      >
        {total > 0 &&
          ASSET_CLASSES.map((c) => {
            const pct = ((weights?.[c.id] || 0) / total) * 100;
            if (pct <= 0) return null;
            return (
              <div
                key={c.id}
                style={{ width: `${pct}%`, background: `var(--${c.color})`, opacity: muted ? 0.45 : 1 }}
                title={`${c.fr} ${Math.round(pct)}%`}
              />
            );
          })}
      </div>
    </div>
  );
}
