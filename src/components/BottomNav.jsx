export default function BottomNav({ active, onChange, onAddClick }) {
  const tabs = [
    { key: "dashboard", icon: "ti-home", label: "Accueil" },
    { key: "transactions", icon: "ti-list", label: "Historique" },
    { key: "add", icon: "ti-plus", label: "" },
    { key: "wealth", icon: "ti-chart-pie", label: "Patrimoine" },
    { key: "settings", icon: "ti-settings", label: "Réglages" },
  ];

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        maxWidth: 480,
        margin: "0 auto",
        background: "var(--bg-card)",
        borderTop: "0.5px solid var(--rule)",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        padding: "8px 0 calc(8px + env(safe-area-inset-bottom))",
        zIndex: 50,
      }}
    >
      {tabs.map((tab) => {
        if (tab.key === "add") {
          return (
            <button
              key={tab.key}
              onClick={onAddClick}
              aria-label="Ajouter une transaction"
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "var(--tang)",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginTop: -20,
                boxShadow: "0 4px 16px rgba(255,107,53,0.35)",
              }}
            >
              <i className="ti ti-plus" style={{ fontSize: 22, color: "white" }} aria-hidden="true" />
            </button>
          );
        }
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            style={{
              background: "none",
              border: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              padding: "4px 8px",
              color: isActive ? "var(--ink)" : "var(--ink-3)",
            }}
          >
            <i className={`ti ${tab.icon}`} style={{ fontSize: 20 }} aria-hidden="true" />
            <span style={{ fontSize: 10 }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
