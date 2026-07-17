import { useState, useEffect } from "react";
import { useFinance } from "../context/FinanceContext";
import { useTranslation } from "../hooks/useTranslation";
import { useGoalProgress } from "../hooks/useGoalProgress";
import { currencySymbol } from "../utils/onboardingDraft";
import HeaderMenuButton from "../components/HeaderMenuButton";
import CurrencyPicker from "../components/CurrencyPicker";

const PRESET_ICONS = ["ti-target", "ti-lifebuoy", "ti-home", "ti-plane", "ti-pig-money", "ti-diamond", "ti-car", "ti-heart"];

// Onglet Objectifs — fondation : liste des objectifs avec barre de progression
// (progression branchée sur les assets liés via useGoalProgress) + modale de
// création/édition. Modèles suggérés, projections avancées et section
// Patrimoine viendront ensuite.
export default function GoalsScreen({ onOpenMenu, openSignal }) {
  const t = useTranslation();
  const { assets, defaultCurrency, dashboardDisplayCurrency, addGoal, updateGoal, removeGoal, language } = useFinance();
  const displayCurrency = dashboardDisplayCurrency || defaultCurrency;
  const progress = useGoalProgress(displayCurrency);
  const locale = language === "en" ? "en-US" : "fr-FR";
  const symbol = currencySymbol(displayCurrency);
  const fmt = (n) => Math.round(n).toLocaleString(locale);

  const [editing, setEditing] = useState(null); // objet goal ou {} (nouveau) ou null (fermé)

  // Le FAB « Ajouter » de App.jsx incrémente openSignal → ouvre un nouvel objectif.
  useEffect(() => {
    if (openSignal) setEditing({});
  }, [openSignal]);

  return (
    <div style={{ minHeight: "100dvh", paddingBottom: "6rem" }}>
      <div
        style={{
          position: "sticky", top: 0, zIndex: 10, background: "var(--bg)",
          display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center",
          gap: 8, padding: "1rem 1.25rem",
        }}
      >
        <div style={{ justifySelf: "start" }}><HeaderMenuButton onClick={onOpenMenu} /></div>
        <h1 style={{ fontSize: 18, margin: 0, whiteSpace: "nowrap" }}>{t("nav_goals")}</h1>
        <div style={{ justifySelf: "end" }}>
          <button
            onClick={() => setEditing({})}
            aria-label={t("goals_add")}
            style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--lavi)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}
          >
            <i className="ti ti-plus" style={{ fontSize: 16 }} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 1.25rem", maxWidth: 640, margin: "0 auto" }}>
        {progress.length === 0 ? (
          <div style={{ textAlign: "center", padding: "16vh 1.5rem 0", color: "var(--ink-3)" }}>
            <i className="ti ti-target" style={{ fontSize: 44, opacity: 0.5 }} aria-hidden="true" />
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-2)", margin: "12px 0 4px" }}>{t("goals_empty_title")}</p>
            <p style={{ fontSize: 13, margin: "0 0 18px" }}>{t("goals_empty_sub")}</p>
            <button
              onClick={() => setEditing({})}
              style={{ padding: "11px 20px", borderRadius: "var(--radius-md)", border: "none", background: "var(--lavi)", color: "#fff", fontSize: 14, fontWeight: 600 }}
            >
              {t("goals_add")}
            </button>
          </div>
        ) : (
          progress.map((p) => <GoalCard key={p.goal.id} p={p} symbol={symbol} fmt={fmt} locale={locale} t={t} onEdit={() => setEditing(p.goal)} />)
        )}
      </div>

      {editing && (
        <GoalEditor
          goal={editing}
          assets={assets}
          defaultCurrency={displayCurrency}
          t={t}
          symbol={symbol}
          fmt={fmt}
          onClose={() => setEditing(null)}
          onSave={async (data) => {
            if (editing.id) await updateGoal(editing.id, data);
            else await addGoal(data);
            setEditing(null);
          }}
          onDelete={editing.id ? async () => { await removeGoal(editing.id); setEditing(null); } : null}
        />
      )}
    </div>
  );
}

function GoalCard({ p, symbol, fmt, locale, t, onEdit }) {
  const { goal, current, target, remaining, pct, reached, monthlyNeeded, projectedDate } = p;
  const color = goal.color || "var(--lavi)";
  return (
    <div
      onClick={onEdit}
      className="pw-card"
      style={{ background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "0.5px solid var(--rule)", padding: "16px 18px", cursor: "pointer" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <span style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
          <i className={`ti ${goal.icon || "ti-target"}`} style={{ fontSize: 19, color }} aria-hidden="true" />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{goal.label || t("nav_goals")}</p>
          <p className="pw-num" style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{fmt(current)} / {fmt(target)} {symbol}</p>
        </div>
        {reached && <i className="ti ti-circle-check" style={{ fontSize: 20, color: "var(--sage)" }} aria-hidden="true" />}
      </div>

      <div style={{ height: 8, borderRadius: 6, background: "var(--rule)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: reached ? "var(--sage)" : color, transition: "width 0.3s" }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8 }}>
        <span className="pw-num" style={{ fontSize: 12, fontWeight: 600, color: reached ? "var(--sage)" : "var(--ink-2)" }}>{Math.round(pct)} %</span>
        {reached ? (
          <span style={{ fontSize: 11.5, color: "var(--sage)", fontWeight: 600 }}>{t("goals_reached")}</span>
        ) : (
          <span className="pw-num" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{t("goals_remaining").replace("{amount}", `${fmt(remaining)} ${symbol}`)}</span>
        )}
      </div>

      {!reached && (monthlyNeeded != null || projectedDate) && (
        <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 8, paddingTop: 8, borderTop: "0.5px solid var(--rule)" }}>
          {monthlyNeeded != null
            ? t("goals_monthly_needed").replace("{amount}", `${fmt(monthlyNeeded)} ${symbol}`)
            : t("goals_projected").replace("{date}", projectedDate.toLocaleDateString(locale, { month: "long", year: "numeric" }))}
        </p>
      )}
    </div>
  );
}

function GoalEditor({ goal, assets, defaultCurrency, t, onClose, onSave, onDelete }) {
  const [label, setLabel] = useState(goal.label || "");
  const [icon, setIcon] = useState(goal.icon || "ti-target");
  const [targetAmount, setTargetAmount] = useState(goal.targetAmount ? String(goal.targetAmount) : "");
  const [currency, setCurrency] = useState(goal.currency || defaultCurrency);
  const [linkedAssetIds, setLinkedAssetIds] = useState(goal.linkedAssetIds || []);
  const [deadline, setDeadline] = useState(goal.deadline || "");
  const [monthlyContribution, setMonthlyContribution] = useState(goal.monthlyContribution ? String(goal.monthlyContribution) : "");
  const [showCurrency, setShowCurrency] = useState(false);

  const toggleAsset = (id) =>
    setLinkedAssetIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const canSave = label.trim() && parseFloat(targetAmount) > 0;

  const save = () =>
    onSave({
      label: label.trim(),
      icon,
      color: "var(--lavi)",
      targetAmount: parseFloat(targetAmount),
      currency,
      linkedAssetIds,
      deadline: deadline || null,
      monthlyContribution: monthlyContribution ? parseFloat(monthlyContribution) : null,
    });

  const inputStyle = { width: "100%", padding: "11px 13px", borderRadius: "var(--radius-md)", border: "0.5px solid var(--rule)", background: "var(--bg-card)", color: "var(--ink)", fontSize: 15 };
  const labelStyle = { fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", margin: "0 0 6px", display: "block" };

  return (
    <div className="app-modal">
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--bg)", display: "flex", alignItems: "center", gap: 10, padding: "1rem 1.25rem", borderBottom: "0.5px solid var(--rule)" }}>
        <button onClick={onClose} aria-label={t("dashboard_done")} style={{ background: "none", border: "none", display: "flex" }}>
          <i className="ti ti-x" style={{ fontSize: 20 }} aria-hidden="true" />
        </button>
        <h1 style={{ fontSize: 17, margin: 0 }}>{goal.id ? t("goals_edit_title") : t("goals_new_title")}</h1>
      </div>

      <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: 18, maxWidth: 560, margin: "0 auto" }}>
        <div>
          <label style={labelStyle}>{t("goals_field_label")}</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("goals_field_label_ph")} style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>{t("goals_field_icon")}</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {PRESET_ICONS.map((ic) => (
              <button
                key={ic}
                onClick={() => setIcon(ic)}
                style={{ width: 40, height: 40, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", border: icon === ic ? "1.5px solid var(--lavi)" : "0.5px solid var(--rule)", background: icon === ic ? "var(--lavi-light)" : "var(--bg-card)" }}
              >
                <i className={`ti ${ic}`} style={{ fontSize: 19, color: icon === ic ? "var(--lavi)" : "var(--ink-2)" }} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t("goals_field_target")}</label>
            <input type="number" inputMode="decimal" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} placeholder="0" style={inputStyle} />
          </div>
          <div style={{ width: 110 }}>
            <label style={labelStyle}>{t("goals_field_currency")}</label>
            <button onClick={() => setShowCurrency((v) => !v)} style={{ ...inputStyle, textAlign: "left" }}>{currency}</button>
          </div>
        </div>

        {showCurrency && (
          <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "0.5px solid var(--rule)", padding: "0.75rem 1rem", marginTop: -8 }}>
            <CurrencyPicker value={currency} onSelect={(c) => { setCurrency(c); setShowCurrency(false); }} />
          </div>
        )}

        <div>
          <label style={labelStyle}>{t("goals_field_accounts")}</label>
          <p style={{ fontSize: 11.5, color: "var(--ink-3)", margin: "0 0 8px" }}>{t("goals_field_accounts_hint")}</p>
          {assets.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--ink-3)" }}>{t("goals_no_assets")}</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {assets.map((a) => {
                const on = linkedAssetIds.includes(a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => toggleAsset(a.id)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: "var(--radius-md)", border: on ? "1.5px solid var(--lavi)" : "0.5px solid var(--rule)", background: on ? "var(--lavi-light)" : "var(--bg-card)", textAlign: "left" }}
                  >
                    <i className={`ti ${on ? "ti-checkbox" : "ti-square"}`} style={{ fontSize: 18, color: on ? "var(--lavi)" : "var(--ink-3)" }} aria-hidden="true" />
                    <span style={{ flex: 1, fontSize: 13.5, color: "var(--ink)" }}>{a.name}</span>
                    <span className="pw-num" style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{Math.round(a.value ?? 0).toLocaleString()} {a.currency}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t("goals_field_deadline")}</label>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t("goals_field_monthly")}</label>
            <input type="number" inputMode="decimal" value={monthlyContribution} onChange={(e) => setMonthlyContribution(e.target.value)} placeholder="0" style={inputStyle} />
          </div>
        </div>

        {onDelete && (
          <button onClick={onDelete} style={{ padding: "11px 0", borderRadius: "var(--radius-md)", border: "0.5px solid var(--red)", background: "transparent", color: "var(--red)", fontSize: 14, fontWeight: 500 }}>
            {t("goals_delete")}
          </button>
        )}
      </div>

      {/* Footer collant : le bouton d'enregistrement reste visible même en
          faisant défiler le formulaire (même pattern que les autres modales). */}
      <div style={{ position: "sticky", bottom: 0, background: "var(--bg)", borderTop: "0.5px solid var(--rule)", padding: "0.75rem 1.25rem" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <button
            onClick={save}
            disabled={!canSave}
            style={{ width: "100%", padding: "13px 0", borderRadius: "var(--radius-md)", border: "none", background: canSave ? "var(--lavi)" : "var(--rule)", color: canSave ? "#fff" : "var(--ink-3)", fontSize: 15, fontWeight: 600 }}
          >
            {goal.id ? t("goals_save") : t("goals_create")}
          </button>
        </div>
      </div>
    </div>
  );
}
