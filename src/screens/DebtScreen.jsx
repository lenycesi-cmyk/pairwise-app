import { useState } from "react";
import { useFinance } from "../context/FinanceContext";
import { useExchangeRates } from "../hooks/useExchangeRates";
import { useDebtCalculation } from "../hooks/useDebtCalculation";
import { useTranslation } from "../hooks/useTranslation";
import { CURRENCIES } from "../data/categories";
import { getMemberKey } from "../utils/members";

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

export default function DebtScreen() {
  const t = useTranslation();
  const {
    transactions, members, defaultCurrency, dashboardDisplayCurrency,
    debtSettlements, addDebtSettlement, debtTransfers, addDebtTransfer, removeDebtTransfer, language,
  } = useFinance();
  const locale = language === "en" ? "en-US" : "fr-FR";

  // Devise d'affichage locale à cet écran (initialisée sur celle du Dashboard
  // pour rester cohérent avec le widget d'accueil).
  const [displayCurrency, setDisplayCurrency] = useState(dashboardDisplayCurrency || defaultCurrency);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const { convert, loading } = useExchangeRates(displayCurrency);

  const now = new Date();
  const [filterMode, setFilterMode] = useState("total"); // "total" | "month" | "range"
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [rangeStart, setRangeStart] = useState(isoDate(new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())));
  const [rangeEnd, setRangeEnd] = useState(isoDate(now));

  let startDate = null;
  let endDate = null;
  if (filterMode === "month") {
    startDate = new Date(viewYear, viewMonth, 1).toISOString();
    endDate = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59).toISOString();
  } else if (filterMode === "range") {
    startDate = rangeStart ? new Date(rangeStart).toISOString() : null;
    endDate = rangeEnd ? new Date(`${rangeEnd}T23:59:59`).toISOString() : null;
  }

  const debt = useDebtCalculation(transactions, members, displayCurrency, convert, {
    startDate,
    endDate,
    settlements: debtSettlements,
    transfers: debtTransfers,
  });

  const [showTransferSheet, setShowTransferSheet] = useState(false);

  function changeMonth(delta) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m > 11) { m = 0; y++; }
    if (m < 0) { m = 11; y--; }
    setViewMonth(m);
    setViewYear(y);
  }

  // Mois COURT, comme le sélecteur de période : ce libellé est encadré par les
  // flèches ‹ ›, et sa largeur variable les faisait glisser d'un mois à l'autre.
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(locale, { month: "short", year: "numeric" });

  async function handleMarkAsPaid() {
    if (!confirm(t("debt_mark_paid_confirm"))) return;
    await addDebtSettlement(new Date().toISOString(), "", {
      amount: debt.owesAmount,
      currency: displayCurrency,
    });
  }

  if (loading) {
    return (
      <div style={{ padding: "2rem 1.5rem" }}>
        <div className="skeleton" style={{ height: 180, marginBottom: 16 }} />
      </div>
    );
  }

  if (!debt) {
    return (
      <div style={{ padding: "2rem 1.5rem", textAlign: "center" }}>
        <p style={{ fontSize: 14, color: "var(--ink-3)" }}>
          {t("debt_invite_partner")}
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "1.25rem 1.25rem 6rem", maxWidth: 640, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 12 }}>
        <button
          onClick={() => setShowCurrencyPicker(!showCurrencyPicker)}
          style={{
            height: 30, padding: "0 10px", borderRadius: "var(--radius-md)",
            border: "0.5px solid var(--rule)", background: "var(--bg-card)",
            fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", gap: 4,
          }}
        >
          {displayCurrency} <i className="ti ti-chevron-down" style={{ fontSize: 11 }} aria-hidden="true" />
        </button>
      </div>

      {showCurrencyPicker && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12, background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "0.5px solid var(--rule)", padding: "0.75rem 1rem" }}>
          {CURRENCIES.map((c) => (
            <button
              key={c.code}
              onClick={() => { setDisplayCurrency(c.code); setShowCurrencyPicker(false); }}
              style={{
                padding: "6px 10px", borderRadius: "var(--radius-md)",
                border: displayCurrency === c.code ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
                background: displayCurrency === c.code ? "var(--sky-light)" : "var(--bg)",
                color: displayCurrency === c.code ? "var(--sky)" : "var(--ink)", fontSize: 12,
              }}
            >
              {c.symbol} {c.code}
            </button>
          ))}
        </div>
      )}

      {/* Filtre de période */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[
          { key: "total", label: t("debt_filter_total") },
          { key: "month", label: t("debt_filter_month") },
          { key: "range", label: t("debt_filter_range") },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilterMode(f.key)}
            style={{
              flex: 1,
              padding: 8,
              borderRadius: "var(--radius-md)",
              border: filterMode === f.key ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
              background: filterMode === f.key ? "var(--sky-light)" : "var(--bg-card)",
              color: filterMode === f.key ? "var(--sky)" : "var(--ink)",
              fontSize: 13,
              fontWeight: filterMode === f.key ? 500 : 400,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filterMode === "month" && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16 }}>
          <button onClick={() => changeMonth(-1)} aria-label={t("debt_filter_month")} style={navBtnStyle}>
            <i className="ti ti-chevron-left" style={{ fontSize: 16 }} aria-hidden="true" />
          </button>
          <p style={{ fontSize: 14, fontWeight: 500, textTransform: "capitalize", minWidth: 78, textAlign: "center" }}>{monthLabel}</p>
          <button onClick={() => changeMonth(1)} aria-label={t("debt_filter_month")} style={navBtnStyle}>
            <i className="ti ti-chevron-right" style={{ fontSize: 16 }} aria-hidden="true" />
          </button>
        </div>
      )}

      {filterMode === "range" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            type="date"
            value={rangeStart}
            onChange={(e) => setRangeStart(e.target.value)}
            style={rangeInputStyle}
          />
          <input
            type="date"
            value={rangeEnd}
            onChange={(e) => setRangeEnd(e.target.value)}
            style={rangeInputStyle}
          />
        </div>
      )}

      <div
        className="pw-card"
        data-accent="pink"
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-lg)",
          border: "0.5px solid var(--rule)",
          padding: "1.5rem 1.25rem",
          marginBottom: 16,
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <Avatar name={debt.a.name} color="sky" offset />
          <Avatar name={debt.b.name} color="blush" />
        </div>
        {debt.owesAmount === 0 ? (
          <p style={{ fontSize: 13, color: "var(--ink-2)" }}>{t("debt_nothing")}</p>
        ) : (
          <p style={{ fontSize: 13, color: "var(--ink-2)" }}>
            {t("debt_owes").replace("{from}", debt.owesFromName).replace("{to}", debt.owesToName)}
          </p>
        )}
        <p style={{ fontSize: 32, fontWeight: 500, color: "var(--sky)", marginTop: 4 }}>
          {Math.round(debt.owesAmount).toLocaleString(locale)} {displayCurrency}
        </p>
        {filterMode === "total" && debt.latestSettlement && (
          <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 8 }}>
            {t("debt_since_settlement").replace("{date}", new Date(debt.latestSettlement.date).toLocaleDateString(locale))}
          </p>
        )}
        {filterMode === "total" && debt.owesAmount > 0 && (
          <button
            onClick={handleMarkAsPaid}
            style={{
              marginTop: 14,
              width: "100%",
              padding: "10px 0",
              borderRadius: "var(--radius-md)",
              border: "none",
              background: "var(--sage)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <i className="ti ti-check" style={{ fontSize: 14 }} aria-hidden="true" />
            {t("debt_mark_paid")}
          </button>
        )}
        {filterMode === "total" && (
          <button
            onClick={() => setShowTransferSheet(true)}
            style={{
              marginTop: 8,
              width: "100%",
              padding: "10px 0",
              borderRadius: "var(--radius-md)",
              border: "1px dashed var(--rule)",
              background: "transparent",
              color: "var(--ink-2)",
              fontSize: 12.5,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <i className="ti ti-arrows-exchange" style={{ fontSize: 14 }} aria-hidden="true" />
            {t("debt_add_transfer")}
          </button>
        )}
      </div>

      <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>
        {t("debt_shared_detail")}
      </p>
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-lg)",
          border: "0.5px solid var(--rule)",
          overflow: "hidden",
        }}
      >
        {debt.activity.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center", padding: "1.5rem 0" }}>
            {t("debt_no_shared")}
          </p>
        ) : (
          debt.activity.map((item, i) => (
            <ActivityRow
              key={item.id}
              item={item}
              last={i === debt.activity.length - 1}
              t={t}
              locale={locale}
              onDelete={item.kind === "transfer" ? () => {
                if (confirm(t("debt_transfer_delete_confirm"))) removeDebtTransfer(item.id);
              } : null}
            />
          ))
        )}
      </div>

      {showTransferSheet && (
        <TransferSheet
          a={debt.a}
          b={debt.b}
          defaultCurrency={displayCurrency}
          t={t}
          onClose={() => setShowTransferSheet(false)}
          onSave={async (entry) => {
            await addDebtTransfer(entry);
            setShowTransferSheet(false);
          }}
        />
      )}
    </div>
  );
}

// Une ligne du détail combiné : dépense partagée (comme avant) ou virement
// (fond teinté distinct, puce d'icône, "De X à Y" au lieu de "Payé par X").
function ActivityRow({ item, last, t, locale, onDelete }) {
  if (item.kind === "transfer") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px",
          borderBottom: last ? "none" : "0.5px solid var(--rule)",
          background: "color-mix(in srgb, var(--lavi-light) 55%, transparent)",
        }}
      >
        <span
          style={{
            width: 26, height: 26, borderRadius: 8, flexShrink: 0,
            background: "var(--lavi-light)", color: "var(--lavi)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
          }}
        >
          <i className="ti ti-arrows-exchange" aria-hidden="true" />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--lavi)" }}>
            {item.note || t("debt_transfer_row_label")}
          </p>
          <p style={{ fontSize: 11, color: "var(--ink-3)" }}>
            {t("debt_transfer_row_meta").replace("{from}", item.paidByName).replace("{to}", item.forName)}
          </p>
        </div>
        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--sky)" }}>
          +{Math.round(item.share).toLocaleString(locale)}
        </p>
        {onDelete && (
          <button
            onClick={onDelete}
            aria-label={t("debt_transfer_delete_confirm")}
            style={{ background: "none", border: "none", color: "var(--ink-3)", fontSize: 14, padding: 4, flexShrink: 0 }}
          >
            <i className="ti ti-trash" aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 14px",
        borderBottom: last ? "none" : "0.5px solid var(--rule)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13 }}>{item.description}</p>
        <p style={{ fontSize: 11, color: "var(--ink-3)" }}>
          {t("debt_paid_by").replace("{name}", item.paidByName)} · {item.label ?? t("debt_for").replace("{name}", item.forName)}
        </p>
      </div>
      <p style={{ fontSize: 13, fontWeight: 500, color: "var(--sky)" }}>
        +{Math.round(item.share).toLocaleString(locale)}
      </p>
    </div>
  );
}

// Feuille "Ajouter un virement" : montant + devise, direction (qui a envoyé
// à qui, deux cartes tap plutôt qu'un menu), date, note libre facultative.
function TransferSheet({ a, b, defaultCurrency, t, onClose, onSave }) {
  const aKey = getMemberKey(a);
  const bKey = getMemberKey(b);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [showCurPick, setShowCurPick] = useState(false);
  const [fromKey, setFromKey] = useState(aKey);
  const [date, setDate] = useState(isoDate(new Date()));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const toKey = fromKey === aKey ? bKey : aKey;
  const amountNum = parseFloat(String(amount).replace(",", "."));
  const canSave = Number.isFinite(amountNum) && amountNum > 0 && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({
        date: new Date(date).toISOString(),
        amount: amountNum,
        currency,
        fromKey,
        toKey,
        note: note.trim(),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        // z-index arbitraire mais suffisant : ce voile est un DESCENDANT du
        // .app-modal (z-index 100) posé par ModalWrapper autour de DebtScreen,
        // donc il crée sa propre pile à l'intérieur de celle-ci — il n'a pas
        // besoin de rivaliser avec les paliers globaux (tabbar 90, tx-modal 110).
        position: "fixed", inset: 0, zIndex: 60,
        background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%", maxWidth: 640,
          background: "var(--bg-card)", borderRadius: "24px 24px 0 0",
          boxShadow: "var(--shadow-lg)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 4px" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, margin: 0 }}>{t("debt_add_transfer")}</h3>
          <button
            onClick={onClose}
            aria-label={t("debt_transfer_close")}
            style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--rule)", border: "none", color: "var(--ink-2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: "14px 20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={fieldLabelStyle}>{t("debt_transfer_amount_label")}</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                style={{
                  flex: 1, fontSize: 22, fontWeight: 600, fontFamily: "var(--font-display)",
                  background: "var(--bg)", border: "1.5px solid var(--rule)", borderRadius: "var(--radius-md)",
                  padding: "10px 14px", color: "var(--ink)", outline: "none",
                }}
              />
              <button
                onClick={() => setShowCurPick(!showCurPick)}
                style={{
                  width: 82, background: "var(--bg)", border: "1.5px solid var(--rule)", borderRadius: "var(--radius-md)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 14, fontWeight: 600, color: "var(--ink)",
                }}
              >
                {currency} <i className="ti ti-chevron-down" style={{ fontSize: 11 }} aria-hidden="true" />
              </button>
            </div>
            {showCurPick && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {CURRENCIES.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => { setCurrency(c.code); setShowCurPick(false); }}
                    style={{
                      padding: "6px 10px", borderRadius: "var(--radius-md)",
                      border: currency === c.code ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
                      background: currency === c.code ? "var(--sky-light)" : "var(--bg)",
                      color: currency === c.code ? "var(--sky)" : "var(--ink)", fontSize: 12,
                    }}
                  >
                    {c.symbol} {c.code}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label style={fieldLabelStyle}>{t("debt_transfer_who_label")}</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[a, b].map((m) => {
                const key = getMemberKey(m);
                const other = key === aKey ? b : a;
                const sel = fromKey === key;
                return (
                  <button
                    key={key}
                    onClick={() => setFromKey(key)}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
                      borderRadius: "var(--radius-md)",
                      border: sel ? "1.5px solid var(--lavi)" : "1.5px solid var(--rule)",
                      background: sel ? "var(--lavi-light)" : "var(--bg)",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                      {m.name?.[0]?.toUpperCase() || "?"}
                    </span>
                    <span style={{ fontSize: 12.5, lineHeight: 1.3 }}>
                      <b style={{ display: "block", fontSize: 12.5 }}>{m.name}</b>
                      <small style={{ color: "var(--ink-3)", fontSize: 10.5 }}>
                        {t("debt_transfer_sends_to_short").replace("{other}", other.name)}
                      </small>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={fieldLabelStyle}>{t("debt_transfer_date_label")}</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={rangeInputStyle}
            />
          </div>

          <div>
            <label style={fieldLabelStyle}>{t("debt_transfer_note_label")}</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("debt_transfer_note_placeholder")}
              style={{
                width: "100%", background: "var(--bg)", border: "1.5px solid var(--rule)", borderRadius: "var(--radius-md)",
                padding: "10px 12px", color: "var(--ink)", fontSize: 13, fontFamily: "var(--font-sans)", outline: "none",
              }}
            />
          </div>

          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              marginTop: 2, width: "100%", padding: "13px 0", borderRadius: "var(--radius-md)", border: "none",
              background: "var(--lavi)", color: "#fff", fontSize: 14, fontWeight: 600,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              opacity: canSave ? 1 : 0.5,
            }}
          >
            <i className="ti ti-arrows-exchange" aria-hidden="true" />
            {t("debt_transfer_save")}
          </button>
        </div>
      </div>
    </div>
  );
}

const fieldLabelStyle = {
  display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.04em", color: "var(--ink-3)", marginBottom: 6,
};

function Avatar({ name, color, offset }) {
  const colorMap = {
    sky: { bg: "var(--sky-light)", text: "var(--sky)" },
    blush: { bg: "var(--blush-light)", text: "var(--blush)" },
  };
  const c = colorMap[color];
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: c.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 15,
        fontWeight: 500,
        color: c.text,
        border: "2px solid var(--bg-card)",
        marginRight: offset ? -8 : 0,
      }}
    >
      {name?.[0]?.toUpperCase() || "?"}
    </div>
  );
}

const navBtnStyle = {
  width: 30,
  height: 30,
  borderRadius: "50%",
  background: "var(--bg-card)",
  border: "0.5px solid var(--rule)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const rangeInputStyle = {
  flex: 1,
  padding: "8px 10px",
  borderRadius: "var(--radius-md)",
  border: "0.5px solid var(--rule)",
  background: "var(--bg-card)",
  fontSize: 13,
  color: "var(--ink)",
};
