import { useState, useMemo } from "react";
import { useFinance } from "../context/FinanceContext";
import { useExchangeRates } from "../hooks/useExchangeRates";
import { getCryptoPrice, getCryptoPriceAtDate, getStockPrice } from "../utils/assetPrices";
import { CURRENCIES } from "../data/categories";

const PERIODS = [
  { key: "3m", label: "3 mois", months: 3 },
  { key: "6m", label: "6 mois", months: 6 },
  { key: "1y", label: "1 an", months: 12 },
];

export default function InvestmentCalculatorScreen({ onClose }) {
  const { transactions, categories, assets, defaultCurrency } = useFinance();
  const { convert } = useExchangeRates(defaultCurrency);

  const [period, setPeriod] = useState("6m");
  const [categoryId, setCategoryId] = useState(null);
  const [subcategory, setSubcategory] = useState(null);
  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const [computing, setComputing] = useState(false);
  const [result, setResult] = useState(null);

  const currencySymbol = CURRENCIES.find((c) => c.code === defaultCurrency)?.symbol || defaultCurrency;

  const expenseCategories = categories.filter((c) => c.id !== "income" && c.id !== "investment");
  const selectedCategory = categories.find((c) => c.id === categoryId);

  // Actifs avec un prix d'API trackable dans le temps (crypto principalement)
  const investableAssets = assets.filter((a) => a.apiId);

  const periodMonths = PERIODS.find((p) => p.key === period)?.months || 6;

  const totalSpent = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now.getFullYear(), now.getMonth() - periodMonths, now.getDate());

    let total = 0;
    for (const tx of transactions) {
      if (tx.type !== "expense") continue;
      const d = new Date(tx.date);
      if (d < cutoff) continue;
      if (categoryId && tx.categoryId !== categoryId) continue;
      if (subcategory && tx.subcategory !== subcategory) continue;

      const val = tx.convertedAmount !== undefined && tx.convertedCurrency === defaultCurrency
        ? tx.convertedAmount
        : convert(tx.amount, tx.currency, defaultCurrency);
      total += val;
    }
    return total;
  }, [transactions, categoryId, subcategory, periodMonths, defaultCurrency]);

  async function handleCompute() {
    const asset = assets.find((a) => a.id === selectedAssetId);
    if (!asset || totalSpent <= 0) return;

    setComputing(true);
    try {
      const now = new Date();
      const pastDate = new Date(now.getFullYear(), now.getMonth() - periodMonths, now.getDate());

      let pastPrice, currentPrice;

      if (asset.apiId && asset.quantity !== undefined) {
        // Actif crypto trackable dans le temps
        const [pastRes, currentRes] = await Promise.all([
          getCryptoPriceAtDate(asset.apiId, pastDate, defaultCurrency.toLowerCase()),
          getCryptoPrice(asset.apiId, defaultCurrency.toLowerCase()),
        ]);
        pastPrice = pastRes.price;
        currentPrice = currentRes.price;
      }

      if (!pastPrice || !currentPrice) {
        setResult({ error: true });
        setComputing(false);
        return;
      }

      const growthFactor = currentPrice / pastPrice;
      const hypotheticalValue = totalSpent * growthFactor;
      const gain = hypotheticalValue - totalSpent;
      const gainPct = (growthFactor - 1) * 100;

      setResult({
        error: false,
        assetName: asset.name,
        spent: totalSpent,
        hypotheticalValue,
        gain,
        gainPct,
      });
    } catch (err) {
      console.error(err);
      setResult({ error: true });
    } finally {
      setComputing(false);
    }
  }

  function formatAmount(n) {
    return Math.round(n).toLocaleString("fr-FR");
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg)",
        zIndex: 100,
        overflowY: "auto",
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      <div style={{ padding: "1.5rem 1.25rem 6rem" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <button onClick={onClose} aria-label="Fermer" style={{ background: "none", border: "none" }}>
            <i className="ti ti-x" style={{ fontSize: 20 }} aria-hidden="true" />
          </button>
          <h1 style={{ fontSize: 18, flex: 1, textAlign: "center" }}>Et si j'avais investi ?</h1>
          <div style={{ width: 20 }} />
        </div>

        <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 16, lineHeight: 1.5 }}>
          Découvrez ce que vos dépenses dans une catégorie auraient pu valoir si elles avaient
          été investies à la place.
        </p>

        {/* Période */}
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            border: "0.5px solid var(--rule)",
            padding: "1rem 1.25rem",
            marginBottom: 12,
          }}
        >
          <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 8 }}>Période</p>
          <div style={{ display: "flex", gap: 6 }}>
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => { setPeriod(p.key); setResult(null); }}
                style={{
                  flex: 1, padding: 8, borderRadius: "var(--radius-md)",
                  border: period === p.key ? "0.5px solid var(--lavi)" : "0.5px solid var(--rule)",
                  background: period === p.key ? "var(--lavi-light)" : "var(--bg)",
                  color: period === p.key ? "var(--lavi)" : "var(--ink)",
                  fontSize: 13,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Catégorie de dépense */}
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            border: "0.5px solid var(--rule)",
            padding: "1rem 1.25rem",
            marginBottom: 12,
          }}
        >
          <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 8 }}>
            Catégorie de dépense (optionnel — laissez vide pour tout inclure)
          </p>
          <select
            value={categoryId || ""}
            onChange={(e) => { setCategoryId(e.target.value || null); setSubcategory(null); setResult(null); }}
            style={{
              width: "100%", padding: "8px 0", border: "none",
              borderBottom: "0.5px solid var(--rule)", background: "transparent",
              fontSize: 14, outline: "none", marginBottom: selectedCategory ? 10 : 0,
            }}
          >
            <option value="">Toutes les dépenses</option>
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {selectedCategory && (
            <select
              value={subcategory || ""}
              onChange={(e) => { setSubcategory(e.target.value || null); setResult(null); }}
              style={{
                width: "100%", padding: "8px 0", border: "none",
                borderBottom: "0.5px solid var(--rule)", background: "transparent",
                fontSize: 14, outline: "none",
              }}
            >
              <option value="">Toutes les sous-catégories</option>
              {selectedCategory.subcategories.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
        </div>

        {/* Montant dépensé (preview) */}
        <div
          style={{
            background: "var(--tang-light)",
            borderRadius: "var(--radius-lg)",
            padding: "1rem 1.25rem",
            marginBottom: 12,
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 12, color: "var(--tang)" }}>Montant dépensé sur la période</p>
          <p style={{ fontSize: 24, fontWeight: 500, color: "var(--tang)" }}>
            {formatAmount(totalSpent)} {currencySymbol}
          </p>
        </div>

        {/* Choix de l'actif comparatif */}
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            border: "0.5px solid var(--rule)",
            padding: "1rem 1.25rem",
            marginBottom: 12,
          }}
        >
          <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 8 }}>
            Si investi dans...
          </p>
          {investableAssets.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--ink-3)" }}>
              Ajoutez un actif crypto suivi par API (ex: Bitcoin) dans votre Patrimoine pour
              activer cette comparaison.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {investableAssets.map((a) => (
                <button
                  key={a.id}
                  onClick={() => { setSelectedAssetId(a.id); setResult(null); }}
                  style={{
                    padding: 10, borderRadius: "var(--radius-md)", textAlign: "left",
                    border: selectedAssetId === a.id ? "0.5px solid var(--lavi)" : "0.5px solid var(--rule)",
                    background: selectedAssetId === a.id ? "var(--lavi-light)" : "var(--bg)",
                    color: selectedAssetId === a.id ? "var(--lavi)" : "var(--ink)",
                    fontSize: 13,
                  }}
                >
                  {a.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleCompute}
          disabled={!selectedAssetId || totalSpent <= 0 || computing}
          style={{
            width: "100%",
            background: "var(--ink)",
            color: "var(--bg)",
            border: "none",
            borderRadius: "var(--radius-lg)",
            padding: 16,
            fontSize: 15,
            fontWeight: 500,
            marginBottom: 16,
            opacity: !selectedAssetId || totalSpent <= 0 || computing ? 0.5 : 1,
          }}
        >
          {computing ? "Calcul en cours..." : "Calculer"}
        </button>

        {result && result.error && (
          <p style={{ fontSize: 13, color: "var(--red)", textAlign: "center" }}>
            Impossible de récupérer les données historiques pour le moment. Réessayez plus tard.
          </p>
        )}

        {result && !result.error && (
          <div
            style={{
              background: "var(--sage-light)",
              borderRadius: "var(--radius-lg)",
              padding: "1.25rem",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 12, lineHeight: 1.6 }}>
              Vos <strong>{formatAmount(result.spent)} {currencySymbol}</strong> dépensés,
              investis dans <strong>{result.assetName}</strong> il y a {PERIODS.find(p => p.key === period)?.label},
              vaudraient aujourd'hui :
            </p>
            <p style={{ fontSize: 30, fontWeight: 500, color: "var(--sage)" }}>
              {formatAmount(result.hypotheticalValue)} {currencySymbol}
            </p>
            <p
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: result.gain >= 0 ? "var(--sage)" : "var(--tang)",
                marginTop: 6,
              }}
            >
              {result.gain >= 0 ? "+" : ""}{formatAmount(result.gain)} {currencySymbol}
              {" "}({result.gainPct >= 0 ? "+" : ""}{result.gainPct.toFixed(1)}%)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
