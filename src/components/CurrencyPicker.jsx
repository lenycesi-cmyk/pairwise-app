import { useState } from "react";
import { useFinance } from "../context/FinanceContext";
import { useTranslation } from "../hooks/useTranslation";
import { CURRENCIES, ALL_CURRENCIES } from "../data/categories";

// Sélecteur de devise partagé par tous les onglets (devise d'affichage) et
// l'ajout de transaction. Propose les devises retenues par le couple
// (enabledCurrencies, sinon le set par défaut), avec la même logique partout :
// sélectionner, gérer (retirer), et ajouter une devise du catalogue via une
// recherche. La liste blanche est stockée au niveau du couple.
export default function CurrencyPicker({ value, onSelect }) {
  const t = useTranslation();
  const { enabledCurrencies, updateEnabledCurrencies, defaultCurrency } = useFinance();
  const [manage, setManage] = useState(false);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");

  const offered =
    enabledCurrencies && enabledCurrencies.length > 0
      ? ALL_CURRENCIES.filter((c) => enabledCurrencies.includes(c.code))
      : CURRENCIES;
  const q = search.trim().toLowerCase();
  const addable = ALL_CURRENCIES.filter(
    (c) =>
      !offered.some((o) => o.code === c.code) &&
      (q === "" || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
  );

  function toggle(code) {
    const current =
      enabledCurrencies && enabledCurrencies.length > 0
        ? enabledCurrencies
        : CURRENCIES.map((c) => c.code);
    let next = current.includes(code) ? current.filter((x) => x !== code) : [...current, code];
    if (next.length === 0) next = [defaultCurrency];
    updateEnabledCurrencies(next);
  }

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {offered.map((c) => {
          const selected = c.code === value;
          const isDefault = c.code === defaultCurrency;
          return (
            <div key={c.code} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                onClick={() => onSelect(c.code)}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                  padding: "10px 12px", borderRadius: "var(--radius-md)",
                  border: selected ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
                  background: selected ? "var(--sky-light)" : "var(--bg)",
                  color: selected ? "var(--sky)" : "var(--ink)", cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 13, textAlign: "left" }}>{c.symbol} {c.code} · {c.name}</span>
                {selected && <i className="ti ti-check" style={{ fontSize: 14 }} aria-hidden="true" />}
              </button>
              {manage && !isDefault && (
                <button
                  type="button"
                  onClick={() => toggle(c.code)}
                  aria-label={t("common_delete")}
                  style={{
                    flexShrink: 0, width: 34, height: 34, borderRadius: "var(--radius-md)",
                    border: "0.5px solid var(--rule)", background: "var(--bg)", color: "var(--ink-3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <i className="ti ti-x" style={{ fontSize: 15 }} aria-hidden="true" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {adding ? (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("tx_search_currency")}
              style={{
                flex: 1, padding: "10px 12px", borderRadius: "var(--radius-md)",
                border: "0.5px solid var(--rule)", fontSize: 13, outline: "none",
              }}
            />
            <button
              type="button"
              onClick={() => { setAdding(false); setSearch(""); }}
              aria-label={t("common_cancel")}
              style={{
                flexShrink: 0, width: 34, height: 34, borderRadius: "var(--radius-md)",
                border: "0.5px solid var(--rule)", background: "var(--bg)", color: "var(--ink-3)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <i className="ti ti-x" style={{ fontSize: 15 }} aria-hidden="true" />
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
            {addable.map((c) => (
              <button
                type="button"
                key={c.code}
                onClick={() => { toggle(c.code); onSelect(c.code); setAdding(false); setSearch(""); }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                  padding: "10px 12px", borderRadius: "var(--radius-md)", border: "0.5px solid var(--rule)",
                  background: "var(--bg)", cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 13, color: "var(--ink)", textAlign: "left" }}>{c.symbol} {c.code} · {c.name}</span>
                <i className="ti ti-plus" style={{ fontSize: 14, color: "var(--sky)" }} aria-hidden="true" />
              </button>
            ))}
            {addable.length === 0 && (
              <p style={{ fontSize: 12, color: "var(--ink-3)", textAlign: "center", padding: "8px 0" }}>
                {t("tx_no_currency_found")}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            type="button"
            onClick={() => setAdding(true)}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "9px 12px", borderRadius: "var(--radius-md)", border: "0.5px dashed var(--sky)",
              background: "var(--bg)", color: "var(--sky)", fontSize: 13, fontWeight: 500,
            }}
          >
            <i className="ti ti-plus" style={{ fontSize: 14 }} aria-hidden="true" />
            {t("tx_add_currency")}
          </button>
          <button
            type="button"
            onClick={() => setManage((m) => !m)}
            style={{
              flexShrink: 0, padding: "9px 12px", borderRadius: "var(--radius-md)",
              border: "0.5px solid var(--rule)",
              background: manage ? "var(--ink)" : "var(--bg)",
              color: manage ? "var(--bg)" : "var(--ink-2)", fontSize: 13, fontWeight: 500,
            }}
          >
            {manage ? t("dashboard_done") : t("tx_manage_currencies")}
          </button>
        </div>
      )}
    </div>
  );
}
