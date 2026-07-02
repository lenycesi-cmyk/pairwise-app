import { useState } from "react";
import { useFinance } from "../context/FinanceContext";
import { useExchangeRates } from "../hooks/useExchangeRates";
import { useDebtCalculation } from "../hooks/useDebtCalculation";

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

export default function DebtScreen() {
  const { transactions, members, defaultCurrency, debtSettlements, addDebtSettlement } = useFinance();
  const { convert, loading } = useExchangeRates(defaultCurrency);

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

  const debt = useDebtCalculation(transactions, members, defaultCurrency, convert, {
    startDate,
    endDate,
    settlements: debtSettlements,
  });

  function changeMonth(delta) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m > 11) { m = 0; y++; }
    if (m < 0) { m = 11; y--; }
    setViewMonth(m);
    setViewYear(y);
  }

  async function handleMarkAsPaid() {
    if (!confirm(`Marquer la dette comme réglée aujourd'hui ? Les dépenses partagées avant aujourd'hui ne compteront plus dans le solde "Total".`)) return;
    await addDebtSettlement(new Date().toISOString());
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
          Invitez votre partenaire pour activer le suivi de dette
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "1.5rem 1.25rem 6rem" }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Entre vous</h1>

      {/* Filtre de période */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[
          { key: "total", label: "Total" },
          { key: "month", label: "Mois" },
          { key: "range", label: "Période" },
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
          <button onClick={() => changeMonth(-1)} aria-label="Mois précédent" style={navBtnStyle}>
            <i className="ti ti-chevron-left" style={{ fontSize: 16 }} aria-hidden="true" />
          </button>
          <p style={{ fontSize: 14, fontWeight: 500 }}>{MONTHS[viewMonth]} {viewYear}</p>
          <button onClick={() => changeMonth(1)} aria-label="Mois suivant" style={navBtnStyle}>
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
          <p style={{ fontSize: 13, color: "var(--ink-2)" }}>Rien à régler</p>
        ) : (
          <p style={{ fontSize: 13, color: "var(--ink-2)" }}>{debt.owesText}</p>
        )}
        <p style={{ fontSize: 32, fontWeight: 500, color: "var(--sky)", marginTop: 4 }}>
          {Math.round(debt.owesAmount).toLocaleString("fr-FR")} {defaultCurrency}
        </p>
        {filterMode === "total" && debt.latestSettlement && (
          <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 8 }}>
            Depuis le règlement du {new Date(debt.latestSettlement.date).toLocaleDateString("fr-FR")}
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
            Marquer comme réglée
          </button>
        )}
      </div>

      <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>
        Détail des dépenses partagées
      </p>
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-lg)",
          border: "0.5px solid var(--rule)",
          overflow: "hidden",
        }}
      >
        {debt.sharedTx.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center", padding: "1.5rem 0" }}>
            Aucune dépense partagée
          </p>
        ) : (
          debt.sharedTx.map((tx, i) => (
            <div
              key={tx.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 14px",
                borderBottom: i === debt.sharedTx.length - 1 ? "none" : "0.5px solid var(--rule)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13 }}>{tx.description}</p>
                <p style={{ fontSize: 11, color: "var(--ink-3)" }}>
                  Payé par {tx.paidByName} · {tx.label}
                </p>
              </div>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--sky)" }}>
                +{Math.round(tx.share).toLocaleString("fr-FR")}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

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
