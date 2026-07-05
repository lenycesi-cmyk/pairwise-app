import { useTranslation } from "../hooks/useTranslation";

export default function BottomNav({ active, onChange, onAddClick, addButtonRef, onSettingsClick, settingsOpen }) {
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
            <div key={tab.key} className="bottom-nav-addcol">
              <button
                ref={addButtonRef}
                onClick={() => onAddClick(active)}
                aria-label={t("nav_add")}
                className="bottom-nav-add"
              >
                <i className="ti ti-plus" style={{ fontSize: 22, color: "white" }} aria-hidden="true" />
              </button>
              <span className="bottom-nav-addlabel">{t("nav_add")}</span>
            </div>
          );
        }
        // Quand Settings est ouvert, aucun onglet de page n'est actif (c'est
        // Settings qui l'est) ; on réactive l'onglet courant à la fermeture.
        const isActive = active === tab.key && !settingsOpen;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className="bottom-nav-tab"
            data-active={isActive ? "true" : "false"}
            style={{ color: isActive ? "var(--ink)" : "var(--ink-3)" }}
          >
            <i className={`ti ${tab.icon}`} style={{ fontSize: 20 }} aria-hidden="true" />
            <span style={{ fontSize: 10 }}>{tab.label}</span>
          </button>
        );
      })}
      {/* Desktop-only: settings sits alongside the other tabs in the
          sidebar rail instead of the floating mobile button (.settings-fab). */}
      <button
        onClick={onSettingsClick}
        aria-label={t("nav_settings")}
        className="bottom-nav-tab bottom-nav-settings"
        data-active={settingsOpen ? "true" : "false"}
        style={{ color: settingsOpen ? "var(--ink)" : "var(--ink-3)" }}
      >
        <i className="ti ti-settings" style={{ fontSize: 20 }} aria-hidden="true" />
        <span style={{ fontSize: 10 }}>{t("nav_settings")}</span>
      </button>
    </div>
  );
}
