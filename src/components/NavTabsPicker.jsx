import { useState } from "react";
import { useFinance } from "../context/FinanceContext";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../hooks/useTranslation";
import { getMemberKey } from "../utils/members";
import { NAV_TABS_META, NAV_TABS_COUNT, resolveNavTabs } from "../data/navTabsMeta";

// Sélecteur des 4 onglets de la barre du bas (mobile). Ouvert depuis Réglages
// ou par appui long sur la barre. On impose exactement NAV_TABS_COUNT onglets ;
// l'ordre d'affichage suit NAV_TABS_META (stable). Sauvegarde par membre.
export default function NavTabsPicker({ onClose }) {
  const t = useTranslation();
  const { members, navTabs, updateMemberNavTabs } = useFinance();
  const { user } = useAuth();
  const myKey = getMemberKey(members.find((m) => m.uid === user?.uid));

  const [selected, setSelected] = useState(() => new Set(resolveNavTabs(navTabs[myKey])));

  const toggle = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (next.size < NAV_TABS_COUNT) next.add(key);
      return next;
    });
  };

  const count = selected.size;
  const canSave = count === NAV_TABS_COUNT;

  const save = async () => {
    if (!canSave) return;
    // On conserve l'ordre de NAV_TABS_META pour un placement gauche→droite stable.
    const ordered = NAV_TABS_META.filter((m) => selected.has(m.key)).map((m) => m.key);
    await updateMemberNavTabs(myKey, ordered);
    onClose();
  };

  return (
    <div className="app-modal">
      <div
        style={{
          position: "sticky", top: 0, zIndex: 10, background: "var(--bg)",
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 20px", borderBottom: "0.5px solid var(--rule)",
        }}
      >
        <button
          onClick={onClose}
          aria-label={t("common_cancel")}
          style={{ width: 32, height: 32, borderRadius: 99, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "color-mix(in srgb, var(--ink) 6%, transparent)", border: "none", color: "var(--ink-2)", cursor: "pointer" }}
        >
          <i className="ti ti-x" style={{ fontSize: 17 }} aria-hidden="true" />
        </button>
        <h1 style={{ flex: 1, textAlign: "center", margin: 0, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--ink)" }}>
          {t("nav_customize_title")}
        </h1>
        <span style={{ width: 32, height: 32, flexShrink: 0 }} />
      </div>

      <div style={{ padding: "16px 20px", maxWidth: 640, margin: 0 }}>
        <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 4 }}>
          {t("nav_customize_hint")}
        </p>
        <p style={{ fontSize: 12, color: canSave ? "var(--sage)" : "var(--ink-3)", fontWeight: 600, marginBottom: 14 }}>
          {count} / {NAV_TABS_COUNT}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {NAV_TABS_META.map((tab) => {
            const on = selected.has(tab.key);
            const disabled = !on && count >= NAV_TABS_COUNT;
            return (
              <button
                key={tab.key}
                onClick={() => toggle(tab.key)}
                disabled={disabled}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: "var(--radius-md)",
                  border: on ? "1.5px solid var(--sky)" : "0.5px solid var(--rule)",
                  background: on ? "var(--sky-light)" : "var(--bg-card)",
                  color: disabled ? "var(--ink-3)" : "var(--ink)",
                  opacity: disabled ? 0.55 : 1,
                  textAlign: "left", cursor: disabled ? "not-allowed" : "pointer",
                }}
              >
                <i className={`ti ${tab.icon}`} style={{ fontSize: 19, color: on ? "var(--sky)" : "var(--ink-2)" }} aria-hidden="true" />
                <span style={{ flex: 1, fontSize: 14, fontWeight: on ? 600 : 400 }}>{t(tab.labelKey)}</span>
                <i
                  className={`ti ${on ? "ti-check" : "ti-circle"}`}
                  style={{ fontSize: 18, color: on ? "var(--sky)" : "var(--ink-3)" }}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>

        <button
          onClick={save}
          disabled={!canSave}
          style={{
            marginTop: 20, width: "100%", padding: "13px 0",
            borderRadius: "var(--radius-md)", border: "none",
            background: canSave ? "var(--sky)" : "var(--rule)",
            color: canSave ? "#fff" : "var(--ink-3)",
            fontSize: 15, fontWeight: 600, cursor: canSave ? "pointer" : "not-allowed",
          }}
        >
          {t("common_save")}
        </button>
      </div>
    </div>
  );
}
