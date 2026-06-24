import { useFinance } from "../context/FinanceContext";
import { useExchangeRates } from "../hooks/useExchangeRates";
import { useDebtCalculation } from "../hooks/useDebtCalculation";

export default function DebtScreen() {
  const { transactions, members, defaultCurrency } = useFinance();
  const { convert, loading } = useExchangeRates(defaultCurrency);

  const debt = useDebtCalculation(transactions, members, defaultCurrency, convert);

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
        <p style={{ fontSize: 13, color: "var(--ink-2)" }}>{debt.owesText}</p>
        <p style={{ fontSize: 32, fontWeight: 500, color: "var(--sky)", marginTop: 4 }}>
          {Math.round(debt.owesAmount).toLocaleString("fr-FR")} {defaultCurrency}
        </p>
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
