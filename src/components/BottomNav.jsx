import { useTranslation } from "../hooks/useTranslation";
import { useFinance } from "../context/FinanceContext";
import { useAuth } from "../context/AuthContext";
import Logo from "./Logo";

// Menu de navigation « plein écran » (façon Gmail) :
//  • sur mobile, c'est un tiroir hors-écran ouvert par le bouton ☰ du header —
//    contrôlé par `open`/`onClose`, avec un voile cliquable (.nav-scrim) ;
//  • sur desktop (≥1024px), les mêmes classes deviennent le rail latéral
//    permanent (voir styles/layout.css) — `open` n'a alors aucun effet.
// Le bouton « Ajouter » n'apparaît que dans le rail desktop ; sur mobile, c'est
// le FAB flottant rendu par App.jsx qui prend le relais.
export default function NavDrawer({ active, onChange, onAddClick, addButtonRef, onSettingsClick, settingsOpen, open, onClose }) {
  const t = useTranslation();
  const { members, coupleName } = useFinance();
  const { user } = useAuth();

  const coupleLabel =
    members && members.length
      ? members.map((m) => m.name).filter(Boolean).join(" & ")
      : coupleName || "PairWise";

  const tabs = [
    { key: "dashboard", icon: "ti-home", label: t("nav_home") },
    { key: "flux", icon: "ti-arrows-exchange", label: t("nav_flux") },
    { key: "budget", icon: "ti-wallet", label: t("nav_budget") },
    { key: "goals", icon: "ti-target", label: t("nav_goals") },
    { key: "wealth", icon: "ti-chart-pie", label: t("nav_wealth") },
    { key: "credits", icon: "ti-building-bank", label: t("nav_credits") },
    { key: "reports", icon: "ti-chart-bar", label: t("nav_reports") },
  ];

  const go = (key) => {
    onChange(key);
    onClose?.();
  };

  return (
    <>
      <div
        className={`nav-scrim${open ? " open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <nav className={`bottom-nav${open ? " open" : ""}`} aria-label={t("nav_menu")}>
        {/* En-tête : logo (desktop + mobile) + identité du couple (mobile). */}
        <div className="bottom-nav-logo">
          <Logo size={26} />
        </div>
        <div className="nav-identity">
          <div className="nav-identity-name">{coupleLabel}</div>
          {user?.email && <div className="nav-identity-mail">{user.email}</div>}
        </div>

        {/* Bouton « Ajouter » : présent dans le rail desktop uniquement
            (masqué en CSS sur mobile, remplacé par le FAB flottant). */}
        <div className="bottom-nav-addcol" onClick={() => onAddClick(active)}>
          <button
            ref={addButtonRef}
            onClick={(e) => { e.stopPropagation(); onAddClick(active); }}
            aria-label={t("nav_add")}
            className="bottom-nav-add"
          >
            <i className="ti ti-plus" style={{ fontSize: 22, color: "white" }} aria-hidden="true" />
          </button>
          <span className="bottom-nav-addlabel">{t("nav_add")}</span>
        </div>

        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => go(tab.key)}
            className="bottom-nav-tab"
            data-active={active === tab.key && !settingsOpen ? "true" : "false"}
          >
            <i className={`ti ${tab.icon}`} style={{ fontSize: 20 }} aria-hidden="true" />
            <span>{tab.label}</span>
          </button>
        ))}

        <button
          onClick={() => { onSettingsClick(); onClose?.(); }}
          className="bottom-nav-tab bottom-nav-settings"
          data-active={settingsOpen ? "true" : "false"}
        >
          <i className="ti ti-settings" style={{ fontSize: 20 }} aria-hidden="true" />
          <span>{t("nav_settings")}</span>
        </button>
      </nav>
    </>
  );
}
