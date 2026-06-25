import { useState } from "react";
import { ICON_LIBRARY } from "../data/iconLibrary";

export default function IconPicker({ selectedIcon, onSelect, onClose }) {
  const [search, setSearch] = useState("");

  const filteredGroups = ICON_LIBRARY.map((group) => ({
    ...group,
    icons: search
      ? group.icons.filter((icon) =>
          icon.replace("ti-", "").replace(/-/g, " ").includes(search.toLowerCase())
        )
      : group.icons,
  })).filter((group) => group.icons.length > 0);

  return (
    <div
      style={{
        background: "var(--bg-card)",
        borderRadius: "var(--radius-lg)",
        border: "0.5px solid var(--rule)",
        padding: "1rem 1.25rem",
        marginTop: 8,
      }}
    >
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher une icône..."
        style={{
          width: "100%",
          padding: "8px 0",
          border: "none",
          borderBottom: "0.5px solid var(--rule)",
          outline: "none",
          fontSize: 13,
          background: "transparent",
          marginBottom: 12,
        }}
      />

      <div style={{ maxHeight: 280, overflowY: "auto" }}>
        {filteredGroups.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--ink-3)", textAlign: "center", padding: "1rem 0" }}>
            Aucune icône trouvée.
          </p>
        )}
        {filteredGroups.map((group) => (
          <div key={group.theme} style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 6, fontWeight: 500 }}>
              {group.theme.toUpperCase()}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4 }}>
              {group.icons.map((icon) => (
                <button
                  key={icon}
                  onClick={() => { onSelect(icon); onClose?.(); }}
                  aria-label={icon}
                  style={{
                    width: "100%",
                    aspectRatio: "1",
                    borderRadius: "var(--radius-sm)",
                    border: selectedIcon === icon ? "1.5px solid var(--sky)" : "0.5px solid var(--rule)",
                    background: selectedIcon === icon ? "var(--sky-light)" : "var(--bg)",
                    color: selectedIcon === icon ? "var(--sky)" : "var(--ink)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <i className={`ti ${icon}`} style={{ fontSize: 16 }} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
