import { useRef, useState, useEffect } from "react";
import { useFinance } from "../context/FinanceContext";
import { useTranslation } from "../hooks/useTranslation";
import { NAV_TABS_META } from "../data/navTabsMeta";

// Barre de navigation du bas (mobile uniquement — masquée en CSS ≥1024px, où le
// rail latéral prend le relais). Layout : 2 onglets · bouton « + » central · 2
// onglets. Les 4 onglets sont personnalisables par membre (navTabs.{memberKey}),
// modifiables via Réglages OU par un appui long sur la barre (onLongPressEdit).
export default function BottomTabBar({ active, onChange, onAddClick, onLongPressEdit }) {
  const t = useTranslation();
  // `myNavTabs` est résolu dans FinanceContext, avec le cache local en repli le
  // temps que Firestore réponde — sinon la barre affiche les onglets par défaut
  // pendant la première seconde avant de se corriger.
  const { myNavTabs } = useFinance();

  const tabs = myNavTabs
    .map((k) => NAV_TABS_META.find((m) => m.key === k))
    .filter(Boolean);

  // Dimensions mesurées de la barre → tracé SVG du fond avec encoche concave
  // centrée sous le bouton « + » (le trait suit la courbe, l'arrière-plan de
  // l'app est visible entre l'encoche et le bouton).
  const navRef = useRef(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    // Le RO déclenche un 1er callback à l'observe (async) → pas de setState
    // synchrone dans le corps de l'effet.
    const ro = new ResizeObserver(() => setDims({ w: el.offsetWidth, h: el.offsetHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { w, h } = dims;
  const cx = w / 2;
  // Encoche = vrai demi-cercle concentrique au bouton : rayon = rayon du bouton
  // (27px) + marge (~7px). Le bouton, fixé par rapport au haut de la barre
  // (align-self flex-start), a son centre sur l'axe y=0 → gap uniforme partout.
  const R = 34;
  const notchPath = w > 0 ? `M0,0 H${cx - R} A${R},${R} 0 0 0 ${cx + R},0 H${w} V${h} H0 Z` : "";

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
      ref={navRef}
      className="tabbar"
      aria-label={t("nav_menu")}
      onTouchStart={startPress}
      onTouchEnd={cancelPress}
      onTouchMove={cancelPress}
      onContextMenu={(e) => { e.preventDefault(); onLongPressEdit?.(); }}
    >
      <svg className="tabbar-bg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
        {notchPath && (
          <path d={notchPath} fill="var(--bg-card)" stroke="var(--rule)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        )}
      </svg>
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
