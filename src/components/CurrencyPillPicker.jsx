import { useState } from "react";
import { ALL_CURRENCIES, CURRENCIES } from "../data/categories";

// Sélecteur de devise en PASTILLES (liste horizontale + panneau "Gérer"),
// extrait d'AddTransactionScreen pour que le virement du suivi de dette
// duplique la même gestion de devises que "Ajouter une transaction" — même
// liste blanche du couple, même recherche/ajout/retrait — sans réimplémenter
// cette logique une deuxième fois.
//
// Ne pas confondre avec components/CurrencyPicker.jsx : celui-là est un AUTRE
// composant, plus ancien, déjà partagé par la devise d'affichage de neuf
// écrans (liste verticale, coche sur la sélection) et par CurrencyField (champ
// compact des formulaires d'actif). Cette forme en pastilles est propre à la
// SAISIE d'un montant (transaction, virement) ; les deux systèmes coexistent
// à dessein, chacun sur son terrain d'origine.
export default function CurrencyPillPicker({ currency, onSelect, defaultCurrency, enabledCurrencies, updateEnabledCurrencies, t }) {
  const [manageCurrencies, setManageCurrencies] = useState(false);
  const [addingCurrency, setAddingCurrency] = useState(false);
  const [currencySearch, setCurrencySearch] = useState("");

  // Devises proposées : liste blanche du couple si définie, sinon les 7 par
  // défaut. La devise déjà saisie (ex. édition d'une vieille transaction) et
  // la devise par défaut restent toujours proposées pour ne pas se bloquer.
  const currencyList =
    enabledCurrencies && enabledCurrencies.length > 0
      ? ALL_CURRENCIES.filter(
          (c) => enabledCurrencies.includes(c.code) || c.code === currency || c.code === defaultCurrency
        )
      : CURRENCIES;

  const offeredCurrencies =
    enabledCurrencies && enabledCurrencies.length > 0
      ? ALL_CURRENCIES.filter((c) => enabledCurrencies.includes(c.code))
      : CURRENCIES;
  const currencyQuery = currencySearch.trim().toLowerCase();
  const addableCurrencies = ALL_CURRENCIES.filter(
    (c) =>
      !offeredCurrencies.some((o) => o.code === c.code) &&
      (currencyQuery === "" ||
        c.code.toLowerCase().includes(currencyQuery) ||
        c.name.toLowerCase().includes(currencyQuery))
  );

  // Bascule une devise dans/hors de la liste blanche du couple. Partant de
  // "toutes" (null), le premier décochage matérialise la liste courante moins
  // la devise retirée. On garde toujours au moins la devise par défaut.
  function toggleEnabledCurrency(code) {
    const current = enabledCurrencies && enabledCurrencies.length > 0 ? enabledCurrencies : CURRENCIES.map((c) => c.code);
    let next = current.includes(code) ? current.filter((x) => x !== code) : [...current, code];
    if (next.length === 0) next = [defaultCurrency];
    updateEnabledCurrencies(next);
  }

  if (!manageCurrencies) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", alignItems: "center" }}>
        {currencyList.map((c) => (
          <button
            key={c.code}
            onClick={() => onSelect(c.code)}
            style={{
              padding: "6px 10px",
              borderRadius: "var(--radius-md)",
              border: currency === c.code ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
              background: currency === c.code ? "var(--sky-light)" : "var(--bg)",
              color: currency === c.code ? "var(--sky)" : "var(--ink)",
              fontSize: 12,
            }}
          >
            {c.code}
          </button>
        ))}
        <button
          onClick={() => setManageCurrencies(true)}
          aria-label={t("tx_manage_currencies")}
          style={{
            padding: "6px 10px",
            borderRadius: "var(--radius-md)",
            border: "0.5px dashed var(--rule)",
            background: "var(--bg)",
            color: "var(--ink-3)",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <i className="ti ti-adjustments" style={{ fontSize: 13 }} aria-hidden="true" />
          {t("tx_manage_currencies")}
        </button>
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 8, textAlign: "center" }}>
        {t("tx_manage_currencies_hint")}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {offeredCurrencies.map((c) => {
          const isDefault = c.code === defaultCurrency;
          return (
            <div
              key={c.code}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                padding: "10px 12px",
                borderRadius: "var(--radius-md)",
                border: "0.5px solid var(--rule)",
                background: "var(--bg)",
              }}
            >
              <span style={{ fontSize: 13, color: "var(--ink)", textAlign: "left" }}>
                {c.symbol} {c.code} · {c.name}
              </span>
              {isDefault ? (
                <span style={{ fontSize: 11, color: "var(--ink-3)", flexShrink: 0 }}>{t("tx_currency_default")}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => toggleEnabledCurrency(c.code)}
                  aria-label={t("common_delete")}
                  style={{ background: "none", border: "none", color: "var(--ink-3)", display: "flex", alignItems: "center", flexShrink: 0 }}
                >
                  <i className="ti ti-x" style={{ fontSize: 15 }} aria-hidden="true" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {!addingCurrency ? (
        <button
          type="button"
          onClick={() => { setAddingCurrency(true); setCurrencySearch(""); }}
          style={{
            marginTop: 8, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "10px 12px", borderRadius: "var(--radius-md)", border: "0.5px dashed var(--sky)",
            background: "var(--bg)", color: "var(--sky)", fontSize: 13, fontWeight: 500,
          }}
        >
          <i className="ti ti-plus" style={{ fontSize: 14 }} aria-hidden="true" />
          {t("tx_add_currency")}
        </button>
      ) : (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <input
              autoFocus
              type="text"
              value={currencySearch}
              onChange={(e) => setCurrencySearch(e.target.value)}
              placeholder={t("tx_search_currency")}
              style={{
                flex: 1, padding: "10px 12px", borderRadius: "var(--radius-md)",
                border: "0.5px solid var(--rule)", fontSize: 13, outline: "none",
              }}
            />
            <button
              type="button"
              onClick={() => { setAddingCurrency(false); setCurrencySearch(""); }}
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
            {addableCurrencies.map((c) => (
              <button
                type="button"
                key={c.code}
                onClick={() => toggleEnabledCurrency(c.code)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                  padding: "10px 12px", borderRadius: "var(--radius-md)", border: "0.5px solid var(--rule)",
                  background: "var(--bg)", cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 13, color: "var(--ink)", textAlign: "left" }}>
                  {c.symbol} {c.code} · {c.name}
                </span>
                <i className="ti ti-plus" style={{ fontSize: 14, color: "var(--sky)" }} aria-hidden="true" />
              </button>
            ))}
            {addableCurrencies.length === 0 && (
              <p style={{ fontSize: 12, color: "var(--ink-3)", textAlign: "center", padding: "8px 0" }}>
                {t("tx_no_currency_found")}
              </p>
            )}
          </div>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
        <button
          onClick={() => { setManageCurrencies(false); setAddingCurrency(false); setCurrencySearch(""); }}
          style={{
            background: "var(--ink)", color: "var(--bg)", border: "none",
            borderRadius: "var(--radius-md)", padding: "6px 16px", fontSize: 13, fontWeight: 500,
          }}
        >
          {t("dashboard_done")}
        </button>
      </div>
    </div>
  );
}
