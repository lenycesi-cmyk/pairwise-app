import { useTranslation } from "../hooks/useTranslation";

export default function BottomNav({ active, onChange, onAddClick, addButtonRef }) {
  const t = useTranslation();
  const tabs = [
    { key: "dashboard", icon: "ti-home", label: t("nav_home") },
    { key: "reports", icon: "ti-chart-bar", label: t("nav_reports") },
    { key: "add", icon: "ti-plus", label: "" },
    { key: "budget", icon: "ti-wallet", label: t("nav_budget") },
    { key: "wealth", icon: "ti-chart-pie", label: t("nav_wealth") },
  ];

  return (
    <div className="bottom-nav">
      {tabs.map((tab) => {
        if (tab.key === "add") {
          return (
            <button
              key={tab.key}
              ref={addButtonRef}
              onClick={() => onAddClick(active)}
              aria-label="Ajouter"
              className="bottom-nav-add"
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
            className="bottom-nav-tab"
            style={{ color: isActive ? "var(--ink)" : "var(--ink-3)" }}
          >
            <i className={`ti ${tab.icon}`} style={{ fontSize: 20 }} aria-hidden="true" />
            <span style={{ fontSize: 10 }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
