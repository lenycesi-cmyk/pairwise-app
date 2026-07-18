import { useState, useEffect } from "react";
import { useFinance } from "../context/FinanceContext";
import { useTranslation } from "../hooks/useTranslation";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useLoanProgress } from "../hooks/useLoanProgress";
import { ALL_CURRENCIES } from "../data/categories";
import { LOAN_TYPES } from "../data/loanTypes";
import { monthlyPayment, extraPaymentImpact } from "../utils/loanMath";
import { currencySymbol } from "../utils/onboardingDraft";
import { getMemberKey } from "../utils/members";
import GreetingHeader from "../components/GreetingHeader";
import HeaderMenuButton from "../components/HeaderMenuButton";
import CurrencyPicker from "../components/CurrencyPicker";
import LoanCard from "../components/LoanCard";

// Onglet « Crédits » : vue d'ensemble multi-crédits (capital restant dû total,
// progression, mensualités cumulées), liste des prêts (cartes LoanCard), et un
// calculateur d'échéance. Versement exceptionnel + liaison transaction viennent
// dans des lots ultérieurs. Devise d'affichage partagée avec le Patrimoine.
export default function CreditScreen({ onOpenMenu, openSignal }) {
  const t = useTranslation();
  const {
    loans, addLoan, updateLoan, removeLoan, members,
    defaultCurrency, wealthDisplayCurrency, updateWealthDisplayCurrency, language,
  } = useFinance();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const displayCurrency = wealthDisplayCurrency || defaultCurrency;
  const { items, aggregate } = useLoanProgress(displayCurrency);
  const locale = language === "en" ? "en-US" : "fr-FR";
  const symbol = currencySymbol(displayCurrency);
  const money = (n) => `${Math.round(n).toLocaleString(locale)} ${symbol}`;

  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [formLoan, setFormLoan] = useState(null); // objet en cours d'édition/création
  const [showForm, setShowForm] = useState(false);
  const [extraLoan, setExtraLoan] = useState(null); // prêt ciblé par un versement exceptionnel

  // Le bouton central « Ajouter » (FAB / rail) déclenche l'ouverture du formulaire.
  useEffect(() => {
    if (openSignal) openCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSignal]);

  function openCreate() {
    setFormLoan({ type: "mortgage", name: "", principal: "", rateAnnual: "", termMonths: "", startDate: new Date().toISOString().slice(0, 10), currency: displayCurrency, monthlyPayment: "", ownership: "shared" });
    setShowForm(true);
  }
  function openEdit(loan) {
    setFormLoan({ ...loan });
    setShowForm(true);
  }
  function closeForm() { setShowForm(false); setFormLoan(null); }

  async function saveForm() {
    const payload = {
      type: formLoan.type,
      name: formLoan.name?.trim() || t(`loan_type_${formLoan.type}`),
      principal: Number(formLoan.principal) || 0,
      rateAnnual: Number(formLoan.rateAnnual) || 0,
      termMonths: Math.round(Number(formLoan.termMonths) || 0),
      startDate: formLoan.startDate,
      currency: formLoan.currency || displayCurrency,
      monthlyPayment: Number(formLoan.monthlyPayment) || 0,
      ownership: formLoan.ownership || "shared",
    };
    if (formLoan.id) await updateLoan(formLoan.id, payload);
    else await addLoan(payload);
    closeForm();
  }

  const canSave = formLoan && Number(formLoan.principal) > 0 && Number(formLoan.termMonths) > 0;

  // Enregistre un versement exceptionnel : ajoute une entrée à extraPayments —
  // loanState le déduit alors du capital restant (et raccourcit l'échéancier).
  async function saveExtraPayment(loan, amount) {
    const amt = Number(amount) || 0;
    if (amt <= 0) return;
    const entry = { id: `xp_${Date.now()}`, amount: amt, date: new Date().toISOString().slice(0, 10) };
    await updateLoan(loan.id, { extraPayments: [...(loan.extraPayments || []), entry] });
    setExtraLoan(null);
  }

  return (
    <div style={{ padding: "0 1.25rem 6rem" }}>
      {/* Header sticky uniforme (cf. autres onglets). */}
      <div style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--bg)", marginLeft: "-1.25rem", marginRight: "-1.25rem", padding: "1rem 1.25rem" }}>
        {(() => {
          const actions = (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                onClick={() => setShowCurrencyPicker((v) => !v)}
                style={{ height: 34, padding: "0 12px", borderRadius: 99, border: "0.5px solid var(--rule)", background: "var(--bg-card)", fontSize: 13, fontWeight: 600, color: "var(--ink)", display: "inline-flex", alignItems: "center", gap: 5 }}
              >
                {symbol} <i className="ti ti-chevron-down" style={{ fontSize: 14, color: "var(--ink-3)" }} aria-hidden="true" />
              </button>
              <button
                onClick={openCreate}
                aria-label={t("loan_add")}
                style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--bg-card)", border: "0.5px solid var(--rule)", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <i className="ti ti-plus" style={{ fontSize: 16 }} aria-hidden="true" />
              </button>
            </div>
          );
          const greeting = <GreetingHeader subtitleKey="credit_subtitle" marginLeft={0} />;
          if (isDesktop) {
            return (
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center" }}>
                {greeting}
                <span />
                <div style={{ justifySelf: "end" }}>{actions}</div>
              </div>
            );
          }
          return (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ justifySelf: "start" }}><HeaderMenuButton onClick={onOpenMenu} /></div>
                <div style={{ justifySelf: "end" }}>{actions}</div>
              </div>
              {greeting}
            </>
          );
        })()}
      </div>

      {showCurrencyPicker && (
        <div style={{ margin: "0 0 14px", background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "0.5px solid var(--rule)", padding: "0.75rem 1rem" }}>
          <CurrencyPicker value={displayCurrency} onSelect={(code) => { updateWealthDisplayCurrency(code); setShowCurrencyPicker(false); }} />
        </div>
      )}

      {loans.length === 0 ? (
        <EmptyState t={t} onAdd={openCreate} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1.1fr 0.9fr" : "1fr", gap: 16, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Vue d'ensemble */}
            <div className="pw-card" style={cardStyle}>
              <div style={cardHead}>
                <span style={{ ...cardIc, background: "var(--tang-light)", color: "var(--tang)" }}><i className="ti ti-building-bank" style={{ fontSize: 19 }} aria-hidden="true" /></span>
                <div>
                  <h2 style={cardTitle}>{t("loan_overview_title")}</h2>
                  <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 1 }}>{t("loan_overview_sub").replace("{count}", aggregate.count)}</div>
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginBottom: 3 }}>{t("loan_total_remaining")}</div>
              <div className="pw-num" style={{ fontFamily: "var(--font-display)", fontSize: 38, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>{money(aggregate.balance)}</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 7 }}>
                {t("loan_repaid_pct").replace("{pct}", Math.round(aggregate.progress * 100))} · <b style={{ color: "var(--ink)" }}>{money(aggregate.originalPrincipal)}</b> {t("loan_borrowed_total")}
              </div>
              <div style={{ height: 11, borderRadius: 99, background: "var(--rule)", overflow: "hidden", margin: "16px 0 10px" }}>
                <div style={{ height: "100%", width: `${Math.min(100, Math.round(aggregate.progress * 100))}%`, background: "var(--sage)" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 16 }}>
                <Stat k={t("loan_monthly_total")} v={money(aggregate.monthly)} />
                <Stat k={t("loan_interest_remaining")} v={money(aggregate.interestRemaining)} />
                <Stat k={t("loan_end")} v={aggregate.lastPayoff ? aggregate.lastPayoff.getFullYear() : "—"} />
              </div>
            </div>

            {/* Liste des crédits */}
            <div className="pw-card" style={cardStyle}>
              <div style={cardHead}>
                <span style={{ ...cardIc, background: "var(--sky-light)", color: "var(--sky)" }}><i className="ti ti-list" style={{ fontSize: 19 }} aria-hidden="true" /></span>
                <div><h2 style={cardTitle}>{t("loan_list_title")}</h2></div>
                <div style={{ flex: 1 }} />
                <button onClick={openCreate} style={{ background: "none", border: "none", color: "var(--sky)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ {t("loan_add_short")}</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {items.map((item, i) => (
                  <LoanCard key={item.loan.id} item={item} displayCurrency={displayCurrency} onEdit={openEdit} onDelete={(l) => removeLoan(l.id)} onExtraPayment={setExtraLoan} defaultOpen={i === 0} />
                ))}
              </div>
            </div>
          </div>

          {/* Calculateur d'échéance */}
          <Calculator t={t} locale={locale} defaultCurrency={displayCurrency} symbol={symbol} />
        </div>
      )}

      {showForm && formLoan && (
        <LoanForm
          t={t} locale={locale} members={members} formLoan={formLoan} setFormLoan={setFormLoan}
          canSave={canSave} onClose={closeForm} onSave={saveForm}
        />
      )}

      {extraLoan && (
        <ExtraPaymentModal
          t={t} locale={locale} symbol={symbol} loan={extraLoan}
          onClose={() => setExtraLoan(null)} onSave={saveExtraPayment}
        />
      )}
    </div>
  );
}

// Modale « versement exceptionnel » : montant → simulation en direct (mois &
// intérêts économisés, nouveau reste à payer) via extraPaymentImpact, puis
// enregistrement.
function ExtraPaymentModal({ t, locale, symbol, loan, onClose, onSave }) {
  const [amount, setAmount] = useState("");
  const money = (n) => `${Math.round(n).toLocaleString(locale)} ${symbol}`;
  const amt = Number(amount) || 0;
  const impact = extraPaymentImpact(loan, amt);
  const valid = amt > 0;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg)", width: "100%", maxWidth: 440, maxHeight: "92vh", overflowY: "auto", borderRadius: 20, padding: "18px 18px 24px", boxShadow: "0 20px 60px rgba(0,0,0,0.28)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700 }}>{t("loan_extra_add")}</h2>
          <button onClick={onClose} aria-label={t("common_close")} style={{ background: "none", border: "none", color: "var(--ink-3)", fontSize: 22, lineHeight: 1, cursor: "pointer" }}>×</button>
        </div>
        <p style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 16 }}>{loan.name}</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
          <label style={{ fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600 }}>{t("loan_extra_amount")}</label>
          <input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" style={inputStyle} />
        </div>

        <div style={{ background: "var(--sage-light)", borderRadius: "var(--radius-md)", padding: "14px 15px" }}>
          <div style={{ fontSize: 12.5, color: "var(--ink-2)", display: "flex", alignItems: "center", gap: 8 }}>
            <i className="ti ti-chart-arrows-vertical" style={{ fontSize: 16, color: "var(--sage)" }} aria-hidden="true" /> {t("loan_extra_impact")}
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, marginTop: 8, color: "var(--sage)", lineHeight: 1.5 }}>
            <span style={{ color: "var(--ink)" }}>−{impact.monthsSaved} {t("loan_months")}</span> {t("loan_extra_on_term")}<br />
            <span style={{ color: "var(--ink)" }}>−{money(impact.interestSaved)}</span> {t("loan_extra_interest_saved")}
          </div>
        </div>
        <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 10, lineHeight: 1.45 }}>
          {t("loan_extra_new_balance")} : <b className="pw-num" style={{ color: "var(--ink)" }}>{money(impact.newBalance)}</b>
        </p>

        <button disabled={!valid} onClick={() => onSave(loan, amt)} style={{ width: "100%", marginTop: 16, padding: 13, borderRadius: 13, border: "none", background: "var(--tang)", color: "#fff", fontSize: 14, fontWeight: 700, opacity: valid ? 1 : 0.5, cursor: valid ? "pointer" : "default" }}>
          {t("loan_extra_save")}
        </button>
      </div>
    </div>
  );
}

function Stat({ k, v }) {
  return (
    <div style={{ background: "color-mix(in srgb, var(--ink) 4%, transparent)", borderRadius: "var(--radius-md)", padding: "11px 13px" }}>
      <div style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 3 }}>{k}</div>
      <div className="pw-num" style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700 }}>{v}</div>
    </div>
  );
}

function EmptyState({ t, onAdd }) {
  return (
    <div className="pw-card" style={{ ...cardStyle, textAlign: "center", padding: "2.5rem 1.5rem" }}>
      <span style={{ width: 56, height: 56, borderRadius: 16, background: "var(--tang-light)", color: "var(--tang)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
        <i className="ti ti-building-bank" style={{ fontSize: 26 }} aria-hidden="true" />
      </span>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{t("loan_empty_title")}</h2>
      <p style={{ fontSize: 13.5, color: "var(--ink-2)", maxWidth: 340, margin: "0 auto 18px", lineHeight: 1.5 }}>{t("loan_empty_desc")}</p>
      <button onClick={onAdd} style={{ padding: "11px 20px", borderRadius: 13, border: "none", background: "var(--tang)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
        ＋ {t("loan_add")}
      </button>
    </div>
  );
}

// Calculateur d'échéance autonome (n'écrit rien) : capital + taux + durée → mensualité.
function Calculator({ t, locale, symbol }) {
  const [P, setP] = useState("30000");
  const [rate, setRate] = useState("4.5");
  const [months, setMonths] = useState("60");
  const M = monthlyPayment(Number(P), Number(rate), Number(months));
  const totalInterest = Math.max(0, M * Number(months) - Number(P));
  const money = (n) => `${Math.round(n).toLocaleString(locale)} ${symbol}`;

  return (
    <div className="pw-card" style={cardStyle}>
      <div style={cardHead}>
        <span style={{ ...cardIc, background: "var(--lavi-light)", color: "var(--lavi)" }}><i className="ti ti-calculator" style={{ fontSize: 19 }} aria-hidden="true" /></span>
        <div><h2 style={cardTitle}>{t("loan_calc_title")}</h2><div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 1 }}>{t("loan_calc_sub")}</div></div>
      </div>
      <Field label={t("loan_field_principal")}><input inputMode="decimal" value={P} onChange={(e) => setP(e.target.value)} style={inputStyle} /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label={t("loan_field_rate")}><input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} style={inputStyle} /></Field>
        <Field label={t("loan_field_term_months")}><input inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} style={inputStyle} /></Field>
      </div>
      <div style={{ background: "var(--lavi-light)", borderRadius: "var(--radius-md)", padding: 14, textAlign: "center", marginTop: 4 }}>
        <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{t("loan_calc_monthly")}</div>
        <div className="pw-num" style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 800, color: "var(--lavi)", marginTop: 3 }}>{money(M)}</div>
        <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 8 }}>{t("loan_calc_total_interest")} : <b className="pw-num" style={{ color: "var(--ink-2)" }}>{money(totalInterest)}</b></div>
      </div>
    </div>
  );
}

// Formulaire ajout/édition d'un prêt (overlay modale).
function LoanForm({ t, locale, members = [], formLoan, setFormLoan, canSave, onClose, onSave }) {
  const set = (k, v) => setFormLoan((f) => ({ ...f, [k]: v }));
  const autoMonthly = monthlyPayment(Number(formLoan.principal), Number(formLoan.rateAnnual), Number(formLoan.termMonths));
  const years = Number(formLoan.termMonths) > 0 ? (Number(formLoan.termMonths) / 12).toFixed(1) : null;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg)", width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto", borderRadius: 20, padding: "18px 18px 24px", boxShadow: "0 20px 60px rgba(0,0,0,0.28)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700 }}>{formLoan.id ? t("loan_edit") : t("loan_add")}</h2>
          <button onClick={onClose} aria-label={t("common_close")} style={{ background: "none", border: "none", color: "var(--ink-3)", fontSize: 22, lineHeight: 1, cursor: "pointer" }}>×</button>
        </div>

        {/* Type */}
        <Field label={t("loan_field_type")}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {LOAN_TYPES.map((ty) => {
              const active = formLoan.type === ty.id;
              return (
                <button key={ty.id} onClick={() => set("type", ty.id)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 99, border: active ? "none" : "0.5px solid var(--rule)", background: active ? `var(--${ty.color}-light)` : "var(--bg-card)", color: active ? `var(--${ty.color})` : "var(--ink-2)", fontSize: 12.5, fontWeight: active ? 700 : 500, cursor: "pointer" }}>
                  <i className={`ti ${ty.icon}`} style={{ fontSize: 15 }} aria-hidden="true" />{t(`loan_type_${ty.id}`)}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label={t("loan_field_name")}><input value={formLoan.name} onChange={(e) => set("name", e.target.value)} placeholder={t(`loan_type_${formLoan.type}`)} style={inputStyle} /></Field>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
          <Field label={t("loan_field_principal")}><input inputMode="decimal" value={formLoan.principal} onChange={(e) => set("principal", e.target.value)} style={inputStyle} /></Field>
          <Field label={t("loan_field_currency")}>
            <select value={formLoan.currency} onChange={(e) => set("currency", e.target.value)} style={inputStyle}>
              {ALL_CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label={t("loan_field_rate")}><input inputMode="decimal" value={formLoan.rateAnnual} onChange={(e) => set("rateAnnual", e.target.value)} style={inputStyle} /></Field>
          <Field label={t("loan_field_term_months")} hint={years ? t("loan_years_hint").replace("{y}", years) : null}>
            <input inputMode="numeric" value={formLoan.termMonths} onChange={(e) => set("termMonths", e.target.value)} style={inputStyle} />
          </Field>
        </div>

        <Field label={t("loan_field_start")}><input type="date" value={formLoan.startDate} onChange={(e) => set("startDate", e.target.value)} style={inputStyle} /></Field>

        {members.length > 1 && (
          <Field label={t("loan_field_owner")}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[{ key: "shared", label: t("asset_shared") }, ...members.map((m) => ({ key: getMemberKey(m), label: m.name }))].map((o) => {
                const active = (formLoan.ownership || "shared") === o.key;
                return (
                  <button key={o.key} onClick={() => set("ownership", o.key)} style={{ padding: "7px 14px", borderRadius: 99, border: active ? "none" : "0.5px solid var(--rule)", background: active ? "var(--lavi-light)" : "var(--bg-card)", color: active ? "var(--lavi)" : "var(--ink-2)", fontSize: 12.5, fontWeight: active ? 700 : 500, cursor: "pointer" }}>
                    {o.label}
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        <Field label={t("loan_field_monthly")} hint={autoMonthly > 0 ? t("loan_monthly_auto").replace("{m}", `${Math.round(autoMonthly).toLocaleString(locale)}`) : null}>
          <input inputMode="decimal" value={formLoan.monthlyPayment} onChange={(e) => set("monthlyPayment", e.target.value)} placeholder={autoMonthly > 0 ? String(Math.round(autoMonthly)) : ""} style={inputStyle} />
        </Field>

        <button disabled={!canSave} onClick={onSave} style={{ width: "100%", marginTop: 14, padding: 13, borderRadius: 13, border: "none", background: "var(--tang)", color: "#fff", fontSize: 14, fontWeight: 700, opacity: canSave ? 1 : 0.5, cursor: canSave ? "pointer" : "default" }}>
          {formLoan.id ? t("common_save") : t("loan_add")}
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 }}>
      <label style={{ fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600 }}>{label}</label>
      {children}
      {hint && <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{hint}</span>}
    </div>
  );
}

const cardStyle = { background: "var(--bg-card)", border: "0.5px solid var(--rule)", borderRadius: "var(--radius-lg)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", padding: 20 };
const cardHead = { display: "flex", alignItems: "center", gap: 11, marginBottom: 16 };
const cardIc = { width: 38, height: 38, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const cardTitle = { fontFamily: "var(--font-display)", fontSize: 16.5, fontWeight: 700, letterSpacing: "-0.01em" };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "0.5px solid var(--rule)", background: "var(--bg-card)", fontSize: 14, color: "var(--ink)", fontFamily: "inherit" };
