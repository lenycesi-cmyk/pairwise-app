import { useState } from "react";
import { useFinance } from "../context/FinanceContext";
import { useTranslation } from "../hooks/useTranslation";
import { useCategoryName } from "../hooks/useCategoryName";
import { getMemberKey } from "../utils/members";
import { splitTag } from "../utils/tags";
import { STATUS_COLOR, STATUS_TINT, STATUS_ICON, budgetLevel } from "../utils/budgetStatus";

// Carte de budget « une carte, un budget » (direction 1B), partagée entre
// l'onglet Budget et le widget du Dashboard. `variant="embedded"` retire le
// châssis (fond/bordure/ombre) pour un rendu dans une carte parente.
export default function BudgetCard({
  p,
  displayCurrency,
  onEdit,
  onToggleActive,
  onDelete,
  dragHandleProps = null,
  variant = "standalone",
  scope: scopeProp = null,
}) {
  const t = useTranslation();
  const { categories, members, coupleName, defaultCurrency, language } = useFinance();
  const { catName, subName } = useCategoryName();
  const [menuOpen, setMenuOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const cur = displayCurrency || defaultCurrency;
  const locale = language === "en" ? "en-US" : "fr-FR";
  const money = (n) => `${Math.round(n).toLocaleString(locale)} ${cur}`;

  const { budget, spent: rawSpent, amountInBase, effectiveAmount, carried, pct: rawPct, projected, scopedTx = [], spentByMember = {} } = p;
  const isInactive = budget.active === false;
  const denom = effectiveAmount > 0 ? effectiveAmount : amountInBase;
  const isCouple = !budget.memberUid || budget.memberUid === "couple";

  // Filtre membre « pour qui » (Famille / A / B) piloté par le sélecteur GLOBAL de
  // la page (prop `scope`) — seulement pour un budget de couple (un budget déjà
  // membre est intrinsèquement scopé). `spent`/`pct`/`level` suivent le filtre.
  const scope = isCouple ? scopeProp : null;
  const spent = scope === null ? rawSpent : (spentByMember[scope] ?? 0);
  const pct = scope === null ? rawPct : (denom > 0 ? (spent / denom) * 100 : 0);
  const level = budgetLevel({ ...p, spent, pct });
  const color = STATUS_COLOR[level];
  const tint = STATUS_TINT[level];
  const remaining = denom - spent;

  // ── Libellés ────────────────────────────────────────────────────────────
  function categoryNames(b) {
    if (b.scope === "global") return t("budget_scope_global");
    if (b.scope === "tag") {
      return (
        (b.tagKeys || [])
          .map((tag) => { const { emoji, text } = splitTag(tag); return emoji ? `${emoji} ${text}` : `#${text}`; })
          .join(", ") || t("budget_scope_tag")
      );
    }
    const catPart = (b.categoryIds || [])
      .map((id) => { const c = categories.find((c) => c.id === id); return c ? catName(c) : null; })
      .filter(Boolean);
    const subPart = (b.subcategoryKeys || []).map((key) => { const [catId, sub] = key.split("::"); return subName(sub, catId); });
    return [...catPart, ...subPart].join(", ") || t("budget_scope_category");
  }
  const budgetLabel = budget.name || categoryNames(budget);
  const memberLabel = isCouple
    ? (coupleName || t("budget_for_couple"))
    : members.find((m) => getMemberKey(m) === budget.memberUid)?.name || coupleName || t("budget_for_couple");

  function periodLabel(b) {
    const pk = b.period || "monthly";
    if (pk === "weekly") return t("budget_period_weekly");
    if (pk === "quarterly") return t("budget_period_quarterly");
    if (pk === "yearly") return t("budget_period_yearly");
    if (pk === "rolling") return t("budget_rolling_label").replace("{n}", b.rollingDays || 30);
    if (pk === "event") {
      const fmt = (d) => new Date(d).toLocaleDateString(locale, { day: "numeric", month: "short" });
      return b.startDate && b.endDate ? `${fmt(b.startDate)} – ${fmt(b.endDate)}` : t("budget_period_event");
    }
    if (b.anchorDay && b.anchorDay > 1) return t("budget_anchor_label").replace("{d}", b.anchorDay);
    return t("budget_period_monthly");
  }

  // Puce catégorie repliée : icône + libellé principal + "+N".
  function budgetChip(b) {
    if (b.scope === "global") return { icon: "ti-wallet", main: t("budget_scope_global"), extra: 0 };
    if (b.scope === "tag") {
      const tags = b.tagKeys || [];
      const first = tags[0] ? splitTag(tags[0]) : null;
      const main = first ? (first.emoji ? `${first.emoji} ${first.text}` : `#${first.text}`) : t("budget_scope_tag");
      return { icon: "ti-tag", main, extra: Math.max(0, tags.length - 1) };
    }
    const items = [];
    for (const id of b.categoryIds || []) {
      const c = categories.find((c) => c.id === id);
      if (c) items.push({ name: catName(c), icon: c.icon });
    }
    for (const key of b.subcategoryKeys || []) {
      const [catId, sub] = key.split("::");
      const c = categories.find((c) => c.id === catId);
      items.push({ name: subName(sub, catId), icon: c?.icon || "ti-tag" });
    }
    if (items.length === 0) return { icon: "ti-tag", main: t("budget_scope_category"), extra: 0 };
    return { icon: items[0].icon || "ti-tag", main: items[0].name, extra: items.length - 1 };
  }
  const chip = budgetChip(budget);

  // Encart projection au ton chaleureux (reliquat comme un gain quand tout va bien).
  function forecastNode() {
    if (projected == null) {
      return { icon: "ti-hourglass-low", bg: "var(--bg)", node: <span style={{ color: "var(--ink-3)" }}>{t("budget_forecast_early")}</span> };
    }
    if (level === "good" || level === "warn") {
      const key = level === "good" ? "budget_forecast_good" : "budget_forecast_warn";
      const [pre, post] = t(key).split("{amount}");
      return { icon: STATUS_ICON[level], bg: tint, node: <>{pre}<b style={{ color, fontWeight: 600 }}>{money(Math.max(0, denom - projected))}</b>{post}</> };
    }
    const [pre, post] = t("budget_forecast_over").split("{amount}");
    const [tpre, tpost] = t("budget_forecast_over_tail").split("{over}");
    return {
      icon: STATUS_ICON.over, bg: tint,
      node: <>{pre}<b style={{ color, fontWeight: 600 }}>{money(projected)}</b>{post}{tpre}<b style={{ color, fontWeight: 600 }}>{money(projected - denom)}</b>{tpost}</>,
    };
  }
  const fc = isInactive ? null : forecastNode();

  // ── Barre + segment fantôme de projection ───────────────────────────────
  const projPct = projected != null && denom > 0 ? (projected / denom) * 100 : pct;
  const fillW = Math.min(pct, 100);
  const ghostW = Math.max(0, Math.min(projPct, 100) - fillW);

  const embedded = variant === "embedded";
  const chrome = embedded
    ? { padding: "2px 0" }
    : { background: "var(--bg-card)", border: "0.5px solid var(--rule)", borderRadius: "var(--radius-lg)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", padding: "15px 16px 14px" };

  return (
    <div
      onClick={() => onEdit?.(budget)}
      style={{ position: "relative", cursor: onEdit ? "pointer" : "default", opacity: isInactive ? 0.55 : 1, ...chrome }}
    >
      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ width: 36, height: 36, borderRadius: 11, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: tint }}>
          <i className={`ti ${chip.icon}`} style={{ fontSize: 18, color }} aria-hidden="true" />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 15.5, fontWeight: 600, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {budgetLabel}
          </p>
          {members.length > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 2, fontSize: 11.5, color: "var(--ink-3)" }}>
              <i className={`ti ${isCouple ? "ti-heart" : "ti-user"}`} style={{ fontSize: 12, color: isCouple ? "var(--tang)" : "var(--ink-3)" }} aria-hidden="true" />
              {memberLabel}
            </span>
          )}
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0, padding: "4px 9px", borderRadius: 99, background: tint, fontSize: 11, fontWeight: 600, color }}>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: color }} />
          {t(`budget_status_${level}`)}
        </span>
        {dragHandleProps && (
          <button
            {...dragHandleProps}
            onClick={(e) => e.stopPropagation()}
            aria-label={t("categories_drag_hint")}
            style={{ background: "none", border: "none", color: "var(--ink-3)", opacity: 0.4, cursor: "grab", touchAction: "none", display: "flex", flexShrink: 0, padding: 0, marginTop: 2 }}
          >
            <i className="ti ti-grip-vertical" style={{ fontSize: 15 }} aria-hidden="true" />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          aria-label="Options"
          style={{ background: "none", border: "none", color: "var(--ink-3)", display: "flex", flexShrink: 0, padding: 0, marginTop: 2 }}
        >
          <i className="ti ti-dots" style={{ fontSize: 16 }} aria-hidden="true" />
        </button>
      </div>

      {/* Menu discret d'actions */}
      {menuOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ position: "absolute", top: embedded ? 30 : 44, right: embedded ? 0 : 12, zIndex: 5, background: "var(--bg-card)", border: "0.5px solid var(--rule)", borderRadius: "var(--radius-md)", boxShadow: "0 8px 24px rgba(0,0,0,0.14)", overflow: "hidden", minWidth: 180 }}
        >
          <button
            onClick={() => { setDetailOpen((v) => !v); setMenuOpen(false); }}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 12px", background: "none", border: "none", fontSize: 13, color: "var(--ink)", textAlign: "left" }}
          >
            <i className="ti ti-list-details" style={{ fontSize: 15, color: "var(--ink-3)" }} aria-hidden="true" />
            {t("budget_tx_detail")}
          </button>
          {onToggleActive && (
            <button
              onClick={() => { onToggleActive(budget); setMenuOpen(false); }}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 12px", background: "none", border: "none", borderTop: "0.5px solid var(--rule)", fontSize: 13, color: "var(--ink)", textAlign: "left" }}
            >
              <i className={`ti ${isInactive ? "ti-player-play" : "ti-player-pause"}`} style={{ fontSize: 15, color: "var(--ink-3)" }} aria-hidden="true" />
              {isInactive ? t("recurring_resume") : t("recurring_pause")}
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => { onDelete(budget); setMenuOpen(false); }}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 12px", background: "none", border: "none", borderTop: "0.5px solid var(--rule)", fontSize: 13, color: "var(--red)", textAlign: "left" }}
            >
              <i className="ti ti-trash" style={{ fontSize: 15 }} aria-hidden="true" />
              {t("common_delete")}
            </button>
          )}
        </div>
      )}

      {/* Bloc RESTE (héros) */}
      <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{remaining >= 0 ? t("budget_remaining") : t("budget_over_by")}</div>
          <div className="pw-num" style={{ fontFamily: "var(--font-display)", fontSize: 25, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.1 }}>
            {money(Math.abs(remaining))}
          </div>
        </div>
        <div className="pw-num" style={{ textAlign: "right", fontSize: 11.5, color: "var(--ink-3)", flexShrink: 0 }}>
          {money(spent)} / {money(denom)}<br />{periodLabel(budget)}
        </div>
      </div>

      {budget.rollover && Math.round(carried) !== 0 && (
        <p className="pw-num" style={{ fontSize: 10.5, color: carried >= 0 ? "var(--sage)" : "var(--red)", marginTop: 3 }}>
          {carried >= 0 ? "+" : ""}{money(carried)} {t("budget_rollover_carried")}
        </p>
      )}

      {/* Barre + segment fantôme */}
      <div role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}
        style={{ marginTop: 11, position: "relative", height: 9, borderRadius: 99, background: "var(--rule)", overflow: "hidden" }}>
        {ghostW > 0 && (
          <div style={{ position: "absolute", top: 0, bottom: 0, left: `${fillW}%`, width: `${ghostW}%`, background: color, opacity: 0.28 }} />
        )}
        <div className="pw-bar-fill" style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${fillW}%`, borderRadius: 99, background: color, transition: "width .4s ease" }} />
      </div>

      {/* Encart projection */}
      {fc && (
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: "var(--radius-md)", background: fc.bg }}>
          <i className={`ti ${fc.icon}`} style={{ fontSize: 16, color: projected == null ? "var(--ink-3)" : color, flexShrink: 0 }} aria-hidden="true" />
          <div className="pw-num" style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.35 }}>{fc.node}</div>
        </div>
      )}

      {/* Catégories repliées */}
      <div style={{ marginTop: 11, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 99, border: "0.5px solid var(--rule)", fontSize: 11, color: "var(--ink-2)", maxWidth: "100%", overflow: "hidden" }}>
          <i className={`ti ${chip.icon}`} style={{ fontSize: 12, color: "var(--ink-3)", flexShrink: 0 }} aria-hidden="true" />
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{chip.main}</span>
        </span>
        {chip.extra > 0 && (
          <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{t("budget_cats_more").replace("{n}", chip.extra)}</span>
        )}
      </div>

      {/* Détail des transactions (ouvert depuis le menu) */}
      {detailOpen && (
        <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 11, borderTop: "0.5px solid var(--rule)", paddingTop: 9 }}>
          {scopedTx.length === 0 ? (
            <p style={{ fontSize: 11.5, color: "var(--ink-3)", textAlign: "center", padding: "6px 0" }}>{t("dashboard_no_expenses")}</p>
          ) : (
            [...scopedTx].sort((a, b) => new Date(b.date) - new Date(a.date)).map((tx) => (
              <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "5px 0" }}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 12, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {tx.description || chip.main}
                  </span>
                  <span style={{ fontSize: 10.5, color: "var(--ink-3)" }}>
                    {new Date(tx.date).toLocaleDateString(locale, { day: "numeric", month: "short" })}
                  </span>
                </span>
                <span className="pw-num" style={{ fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                  {Math.round(tx.amount).toLocaleString(locale)} {tx.currency}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
