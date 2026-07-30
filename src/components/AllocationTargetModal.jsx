import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "../hooks/useTranslation";
import { getAssetType } from "../data/assetTypes";
import {
  ASSET_CLASSES,
  RISK_PROFILES,
  className,
  growthShare,
  matchProfile,
  profileDesc,
  profileName,
  suggestProfileForAge,
  typeIdsForClass,
} from "../data/allocationModels";
import AllocationBar from "./AllocationBar";

// Modale « Allocation cible » : on part d'un profil de risque standard du métier
// (prudent → offensif) puis on ajuste finement classe par classe. Le profil
// n'est pas un état séparé : il est déduit de la grille par `matchProfile`, donc
// toucher un curseur fait naturellement basculer en « Personnalisé ».
export default function AllocationTargetModal({
  weights,
  classTotals,
  investable,
  onSave,
  onClose,
  language,
}) {
  const t = useTranslation();
  const lang = language === "en" ? "en" : "fr";
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(ASSET_CLASSES.map((c) => [c.id, String(weights?.[c.id] || "")]))
  );
  const [age, setAge] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const numeric = useMemo(() => {
    const out = {};
    for (const c of ASSET_CLASSES) {
      const v = parseFloat(draft[c.id]);
      out[c.id] = Number.isFinite(v) && v > 0 ? v : 0;
    }
    return out;
  }, [draft]);

  const sum = ASSET_CLASSES.reduce((s, c) => s + numeric[c.id], 0);
  const rounded = Math.round(sum);
  const canSave = rounded === 100 || rounded === 0;
  const activeProfile = matchProfile(numeric);
  const suggestion = suggestProfileForAge(parseFloat(age));

  function applyProfile(profile) {
    setDraft(Object.fromEntries(ASSET_CLASSES.map((c) => [c.id, String(profile.weights[c.id] || 0)])));
  }

  // Ramène la grille à 100 % au prorata de ce qui est déjà saisi : évite de
  // repartir de zéro quand on a « presque » bon.
  function normalize() {
    if (sum <= 0) return;
    const scaled = ASSET_CLASSES.map((c) => ({ id: c.id, raw: (numeric[c.id] / sum) * 100 }));
    const floored = scaled.map((s) => ({ ...s, val: Math.floor(s.raw) }));
    let rest = 100 - floored.reduce((s, x) => s + x.val, 0);
    // Les points restants vont aux plus grosses décimales (répartition d'Hondt
    // simplifiée) pour tomber pile sur 100 sans fausser les proportions.
    const order = [...floored].sort((a, b) => (b.raw - b.val) - (a.raw - a.val));
    for (const item of order) {
      if (rest <= 0) break;
      item.val += 1;
      rest -= 1;
    }
    setDraft(Object.fromEntries(floored.map((x) => [x.id, String(x.val)])));
  }

  async function save() {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave(numeric, activeProfile?.id || null);
      onClose?.();
    } finally {
      setSaving(false);
    }
  }

  const feedLabel = (classId) =>
    typeIdsForClass(classId)
      .map((typeId) => {
        const ty = getAssetType(typeId);
        return lang === "en" && ty.nameEn ? ty.nameEn : ty.name;
      })
      .join(", ");

  return (
    <div
      onClick={onClose}
      className="pw-dialog-backdrop"
      style={{
        position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "0 12px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="pw-dialog-panel"
        style={{
          background: "var(--bg)", width: "100%", maxWidth: 520, maxHeight: "88vh",
          borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column",
          overflow: "hidden", boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* En-tête */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.9rem 1.1rem", borderBottom: "0.5px solid var(--rule)" }}>
          <span
            className="pw-chip"
            style={{ width: 30, height: 30, borderRadius: 9, background: "var(--sky-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >
            <i className="ti ti-target-arrow" style={{ fontSize: 16, color: "var(--sky)" }} aria-hidden="true" />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 11, color: "var(--ink-3)" }}>{t("alloc_profile")}</p>
            <h2 style={{ fontSize: 15, margin: 0, fontFamily: "var(--font-display)", fontWeight: 600 }}>
              {t("alloc_target_title")}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={t("common_close")}
            style={{
              width: 32, height: 32, borderRadius: 99, flexShrink: 0,
              background: "color-mix(in srgb, var(--ink) 6%, transparent)", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}
          >
            <i className="ti ti-x" style={{ fontSize: 17 }} aria-hidden="true" />
          </button>
        </div>

        <div style={{ padding: "0.9rem 1.1rem", overflowY: "auto" }}>
          {/* 1. Profils standards */}
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>
            {t("alloc_profiles_title")}
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {RISK_PROFILES.map((p) => {
              const selected = activeProfile?.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => applyProfile(p)}
                  style={{
                    textAlign: "left", width: "100%", padding: "10px 11px",
                    borderRadius: "var(--radius-md)", cursor: "pointer",
                    background: selected ? "var(--sky-light)" : "var(--bg-card)",
                    border: `1px solid ${selected ? "var(--sky)" : "var(--rule)"}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <i className={`ti ${p.icon}`} style={{ fontSize: 15, color: "var(--sky)" }} aria-hidden="true" />
                    <span style={{ fontSize: 13.5, fontWeight: 700, flex: 1 }}>{profileName(p, lang)}</span>
                    <span style={{ fontSize: 11, color: "var(--ink-3)" }}>
                      {growthShare(p.weights)}% {t("alloc_growth")}
                    </span>
                    {selected && <i className="ti ti-circle-check-filled" style={{ fontSize: 15, color: "var(--sky)" }} aria-hidden="true" />}
                  </div>
                  <p style={{ fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.45, marginBottom: 7 }}>
                    {profileDesc(p, lang)}
                  </p>
                  <AllocationBar weights={p.weights} height={7} />
                  <p style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 5 }}>
                    {t("alloc_expected")} {lang === "en" ? `${p.ret}%` : `${p.ret} %`} / {t("alloc_per_year")}
                  </p>
                </button>
              );
            })}
          </div>

          {/* 2. Règle des 110 (aide au choix par l'âge) */}
          <div
            style={{
              marginTop: 14, padding: "10px 11px", borderRadius: "var(--radius-md)",
              background: "var(--bg-card)", border: "0.5px solid var(--rule)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <i className="ti ti-calculator" style={{ fontSize: 14, color: "var(--ink-3)" }} aria-hidden="true" />
              <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1 }}>{t("alloc_age_rule")}</span>
              <input
                type="number"
                inputMode="numeric"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder={t("alloc_age_placeholder")}
                aria-label={t("alloc_age_placeholder")}
                style={{
                  width: 62, textAlign: "right", padding: "5px 8px",
                  border: "0.5px solid var(--rule)", borderRadius: "var(--radius-sm)",
                  background: "var(--bg)", color: "var(--ink)", fontSize: 13,
                }}
              />
            </div>
            <p style={{ fontSize: 11, color: "var(--ink-3)", lineHeight: 1.45, marginTop: 6 }}>
              {suggestion
                ? `${t("alloc_age_result")} ${suggestion.growthTarget}% ${t("alloc_growth")} → ${profileName(suggestion.profile, lang)}`
                : t("alloc_age_hint")}
            </p>
            {suggestion && (
              <button
                onClick={() => applyProfile(suggestion.profile)}
                style={{
                  marginTop: 6, background: "none", border: "none", padding: 0,
                  color: "var(--sky)", fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}
              >
                {t("alloc_apply_suggestion")}
              </button>
            )}
          </div>

          {/* 3. Ajustement fin, classe par classe */}
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.4, margin: "16px 0 8px" }}>
            {t("alloc_adjust_title")}
          </p>
          {ASSET_CLASSES.map((c) => {
            const currentPct = investable > 0 ? ((classTotals?.[c.id] || 0) / investable) * 100 : 0;
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 0", borderBottom: "0.5px solid var(--rule)" }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: `var(--${c.color})`, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12.5, fontWeight: 600 }}>{className(c.id, lang)}</p>
                  <p style={{ fontSize: 10.5, color: "var(--ink-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {t("alloc_current")} {currentPct.toFixed(0)}% · {feedLabel(c.id)}
                  </p>
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  value={draft[c.id]}
                  onChange={(e) => setDraft((d) => ({ ...d, [c.id]: e.target.value }))}
                  placeholder="0"
                  aria-label={className(c.id, lang)}
                  style={{
                    width: 62, textAlign: "right", padding: "6px 8px", flexShrink: 0,
                    border: "0.5px solid var(--rule)", borderRadius: "var(--radius-sm)",
                    background: "var(--bg-card)", color: "var(--ink)", fontSize: 13,
                  }}
                />
                <span style={{ fontSize: 12, color: "var(--ink-3)", width: 12, flexShrink: 0 }}>%</span>
              </div>
            );
          })}

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
            <span style={{ fontSize: 12, color: "var(--ink-3)", flex: 1 }}>
              {t("alloc_target_total")}
              {activeProfile ? ` · ${profileName(activeProfile, lang)}` : rounded > 0 ? ` · ${t("alloc_custom")}` : ""}
            </span>
            {rounded !== 100 && rounded !== 0 && (
              <button
                onClick={normalize}
                style={{ background: "none", border: "none", color: "var(--sky)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                {t("alloc_normalize")}
              </button>
            )}
            <span style={{ fontSize: 14, fontWeight: 700, color: canSave ? "var(--sage)" : "var(--tang)" }}>
              {rounded}%
            </span>
          </div>

          <AllocationBar weights={numeric} height={9} />
        </div>

        {/* Pied de modale */}
        <div style={{ display: "flex", gap: 8, padding: "0.8rem 1.1rem", borderTop: "0.5px solid var(--rule)" }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: "11px 0", borderRadius: "var(--radius-md)",
              background: "var(--bg-card)", border: "0.5px solid var(--rule)",
              color: "var(--ink)", fontSize: 13.5, fontWeight: 600, cursor: "pointer",
            }}
          >
            {t("common_cancel")}
          </button>
          <button
            onClick={save}
            disabled={!canSave || saving}
            style={{
              flex: 1, padding: "11px 0", borderRadius: "var(--radius-md)", border: "none",
              background: canSave ? "var(--sky)" : "var(--rule)",
              color: canSave ? "#fff" : "var(--ink-3)",
              fontSize: 13.5, fontWeight: 700, cursor: canSave ? "pointer" : "not-allowed",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {t("common_save")}
          </button>
        </div>
      </div>
    </div>
  );
}
