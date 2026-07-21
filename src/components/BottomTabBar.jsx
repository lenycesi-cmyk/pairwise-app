import { useRef } from "react";
import { useFinance } from "../context/FinanceContext";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../hooks/useTranslation";
import { getMemberKey } from "../utils/members";
import { NAV_TABS_META, resolveNavTabs } from "../data/navTabsMeta";

// Barre de navigation du bas (mobile uniquement — masquée en CSS ≥1024px, où le
// rail latéral prend le relais). Layout : 2 onglets · bouton « + » central · 2
// onglets. Les 4 onglets sont personnalisables par membre (navTabs.{memberKey}),
// modifiables via Réglages OU par un appui long sur la barre (onLongPressEdit).
export default function BottomTabBar({ active, onChange, onAddClick, onLongPressEdit }) {
  const t = useTranslation();
  const { members, navTabs } = useFinance();
  const { user } = useAuth();

  const myKey = getMemberKey(members.find((m) => m.uid === user?.uid));
  const keys = resolveNavTabs(navTabs[myKey]);
  const tabs = keys
    .map((k) => NAV_TABS_META.find((m) => m.key === k))
    .filter(Boolean);

  // Appui long → édition. On mémorise pour supprimer le tap de navigation qui
  // suivrait le relâchement, sinon un appui long naviguerait aussi.
  const timerRef = useRef(null);
  const longPressedRef = useRef(false);
  const startPress = () => {
    longPressedRef.current = false;
    timerRef.current = setTimeout(() => {
      longPressedRef.current = true;
      onLongPressEdit?.();
    }, 550);
  };
  const cancelPress = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleTab = (key) => {
    if (longPressedRef.current) {
      longPressedRef.current = false;
      return;
    }
    onChange(key);
  };

  const renderTab = (tab) => (
    <button
      key={tab.key}
      className="tabbar-item"
      data-active={active === tab.key ? "true" : "false"}
      onClick={() => handleTab(tab.key)}
      aria-label={t(tab.labelKey)}
    >
      <i className={`ti ${tab.icon}`} aria-hidden="true" />
      <span>{t(tab.labelKey)}</span>
    </button>
  );

  return (
    <nav
      className="tabbar"
      aria-label={t("nav_menu")}
      onTouchStart={startPress}
      onTouchEnd={cancelPress}
      onTouchMove={cancelPress}
      onContextMenu={(e) => { e.preventDefault(); onLongPressEdit?.(); }}
    >
      {tabs.slice(0, 2).map(renderTab)}
      <button
        className="tabbar-add"
        onClick={() => { if (!longPressedRef.current) onAddClick(active); }}
        aria-label={t("nav_add")}
      >
        <i className="ti ti-plus" aria-hidden="true" />
      </button>
      {tabs.slice(2, 4).map(renderTab)}
    </nav>
  );
}
