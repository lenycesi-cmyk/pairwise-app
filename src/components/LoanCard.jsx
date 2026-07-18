import { useState } from "react";
import { useFinance } from "../context/FinanceContext";
import { useTranslation } from "../hooks/useTranslation";
import { loanType } from "../data/loanTypes";

// Carte « un crédit » : en-tête (icône type + nom + statut), reste à payer en
// héros, barre de progression capital remboursé, et — dépliable — le détail
// d'amortissement (mensualité, coût total, intérêts, répartition de l'échéance
// courante). `item` vient de useLoanProgress : { loan, state, conv }.
// `variant="embedded"` retire le châssis pour un rendu dans une carte parente.
export default function LoanCard({ item, displayCurrency, onEdit, onDelete, defaultOpen = false, variant = "standalone" }) {
  const t = useTranslation();
  const { language, categories } = useFinance();
  const [open, setOpen] = useState(defaultOpen);
  const [menuOpen, setMenuOpen] = useState(false);

  const { loan, state, conv } = item;
  const type = loanType(loan.type);
  const color = `var(--${type.color})`;
  const tint = `var(--${type.color}-light)`;
  const locale = language === "en" ? "en-US" : "fr-FR";
  const cur = displayCurrency || loan.currency;
  const money = (n) => `${Math.round(n).toLocaleString(locale)} ${cur}`;
  const pct = Math.round(state.progress * 100);

  // Répartition de l'échéance courante (part intérêts vs capital), réelle.
  const monthlyInterest = state.balance * ((Number(loan.rateAnnual) || 0) / 100 / 12);
  const monthlyPrincipal = Math.max(0, state.monthly - monthlyInterest);
  const interestShare = state.monthly > 0 ? (monthlyInterest / state.monthly) * 100 : 0;

  const linkedCat = loan.linkedSubcategory
    ? categories.find((c) => (c.subcategories || []).some((s) => (s.name || s) === loan.linkedSubcategory))
    : null;

  const payoffLabel = state.payoffDate
    ? new Date(state.payoffDate).toLocaleDateString(locale, { month: "short", year: "numeric" })
    : "—";

  const embedded = variant === "embedded";
  const chrome = embedded
    ? { padding: "2px 0" }
    : {
        background: "var(--bg-card)", border: "0.5px solid var(--rule)", borderRadius: "var(--radius-lg)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)", padding: "15px 16px 14px",
      };

  return (
    <div style={{ position: "relative", ...chrome }}>
      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
        <span style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: tint }}>
          <i className={`ti ${type.icon}`} style={{ fontSize: 18, color }} aria-hidden="true" />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {loan.name || t(`loan_type_${type.id}`)}
          </p>
          <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>
            {(Number(loan.rateAnnual) || 0).toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} % · {money(state.monthly)}/{t("loan_per_month")}
          </p>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0, padding: "4px 9px", borderRadius: 99, background: state.isPaidOff ? "var(--sage-light)" : tint, fontSize: 11, fontWeight: 600, color: state.isPaidOff ? "var(--sage)" : color }}>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: state.isPaidOff ? "var(--sage)" : color }} />
          {state.isPaidOff ? t("loan_status_paid") : t("loan_status_active")}
        </span>
        {(onEdit || onDelete) && (
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            aria-label={t("loan_options")}
            style={{ background: "none", border: "none", color: "var(--ink-3)", display: "flex", flexShrink: 0, padding: 0, marginTop: 2 }}
          >
            <i className="ti ti-dots" style={{ fontSize: 16 }} aria-hidden="true" />
          </button>
        )}
        {menuOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: "absolute", top: 40, right: 8, zIndex: 5, background: "var(--bg-card)", border: "0.5px solid var(--rule)", borderRadius: "var(--radius-md)", boxShadow: "0 8px 24px rgba(0,0,0,0.14)", overflow: "hidden", minWidth: 160 }}
          >
            {onEdit && (
              <button onClick={() => { onEdit(loan); setMenuOpen(false); }} style={menuItem}>
                <i className="ti ti-pencil" style={{ fontSize: 15, color: "var(--ink-3)" }} aria-hidden="true" /> {t("common_edit")}
              </button>
            )}
            {onDelete && (
              <button onClick={() => { onDelete(loan); setMenuOpen(false); }} style={{ ...menuItem, color: "var(--red)", borderTop: "0.5px solid var(--rule)" }}>
                <i className="ti ti-trash" style={{ fontSize: 15 }} aria-hidden="true" /> {t("common_delete")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Reste à payer (héros) */}
      <div style={{ marginTop: 14, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{t("loan_remaining")}</div>
          <div className="pw-num" style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.1 }}>
            {money(conv.balance)}
          </div>
        </div>
        <div className="pw-num" style={{ textAlign: "right", fontSize: 11.5, color: "var(--ink-3)", flexShrink: 0 }}>
          {state.paymentsMade} / {state.termMonths} {t("loan_installments")}<br />{t("loan_ends")} {payoffLabel}
        </div>
      </div>

      {/* Barre capital remboursé */}
      <div style={{ marginTop: 11, position: "relative", height: 9, borderRadius: 99, background: "var(--rule)", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${Math.min(100, pct)}%`, borderRadius: 99, background: "var(--sage)", transition: "width .4s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-2)", marginTop: 6 }}>
        <span>{t("loan_repaid")} · {money(conv.principalRepaid)}</span>
        <span className="pw-num">{pct} %</span>
      </div>

      {/* Toggle détail */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ marginTop: 12, background: "none", border: "none", color: "var(--sky)", fontSize: 12, display: "flex", alignItems: "center", gap: 4, padding: 0 }}
      >
        {open ? t("loan_hide_detail") : t("loan_show_detail")}
        <i className={`ti ti-chevron-${open ? "up" : "down"}`} style={{ fontSize: 13 }} aria-hidden="true" />
      </button>

      {open && (
        <div style={{ marginTop: 12, borderTop: "0.5px solid var(--rule)", paddingTop: 12 }}>
          {/* Répartition échéance courante */}
          <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginBottom: 6 }}>{t("loan_payment_split")}</div>
          <div style={{ display: "flex", height: 9, borderRadius: 99, overflow: "hidden", background: "var(--rule)" }}>
            <div style={{ width: `${100 - interestShare}%`, background: "var(--sage)" }} />
            <div style={{ width: `${interestShare}%`, background: "var(--tang)" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-2)", marginTop: 6, marginBottom: 4 }}>
            <span><i className="ti ti-point-filled" style={{ color: "var(--sage)", fontSize: 12, verticalAlign: "middle" }} />{t("loan_capital")} {money(monthlyPrincipal)}</span>
            <span><i className="ti ti-point-filled" style={{ color: "var(--tang)", fontSize: 12, verticalAlign: "middle" }} />{t("loan_interest")} {money(monthlyInterest)}</span>
          </div>

          <Row label={t("loan_monthly")} value={money(conv.monthly)} />
          <Row label={t("loan_total_interest")} value={money(conv.totalInterest)} />
          <Row label={t("loan_interest_paid")} value={money(conv.interestPaid)} />
          <Row label={t("loan_capital_repaid")} value={money(conv.principalRepaid)} valueColor="var(--sage)" />
          {linkedCat && (
            <Row label={t("loan_linked_sub")} value={<span style={{ fontSize: 12, color: "var(--sky)" }}>🔗 {loan.linkedSubcategory}</span>} />
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, valueColor }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "9px 0", borderBottom: "0.5px solid var(--rule)", fontSize: 13 }}>
      <span style={{ color: "var(--ink-2)" }}>{label}</span>
      <span className="pw-num" style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: valueColor || "var(--ink)" }}>{value}</span>
    </div>
  );
}

const menuItem = {
  display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 12px",
  background: "none", border: "none", fontSize: 13, color: "var(--ink)", textAlign: "left", cursor: "pointer",
};
