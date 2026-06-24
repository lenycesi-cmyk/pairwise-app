export default function DebtSummaryCard({ debt, defaultCurrency, onClick }) {
  if (!debt) return null;

  const colorMap = {
    sky: { bg: "var(--sky-light)", text: "var(--sky)" },
    blush: { bg: "var(--blush-light)", text: "var(--blush)" },
  };

  function Avatar({ name, color, offset, photoURL }) {
    const c = colorMap[color];
    if (photoURL) {
      return (
        <img
          src={photoURL}
          alt={name}
          style={{
            width: 32, height: 32, borderRadius: "50%", objectFit: "cover",
            border: "2px solid var(--bg-card)", marginRight: offset ? -8 : 0,
          }}
        />
      );
    }
    return (
      <div
        style={{
          width: 32, height: 32, borderRadius: "50%", background: c.bg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 500, color: c.text,
          border: "2px solid var(--bg-card)", marginRight: offset ? -8 : 0,
        }}
      >
        {name?.[0]?.toUpperCase() || "?"}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--bg-card)",
        borderRadius: "var(--radius-lg)",
        border: "0.5px solid var(--rule)",
        padding: "0.875rem 1.25rem",
        marginBottom: 20,
        display: "flex",
        alignItems: "center",
        gap: 12,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{ display: "flex" }}>
        <Avatar name={debt.a.name} color="sky" offset photoURL={debt.a.photoURL} />
        <Avatar name={debt.b.name} color="blush" photoURL={debt.b.photoURL} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, color: "var(--ink-2)" }}>{debt.owesText}</p>
        <p style={{ fontSize: 18, fontWeight: 500, color: "var(--sky)" }}>
          {Math.round(debt.owesAmount).toLocaleString("fr-FR")} {defaultCurrency}
        </p>
      </div>
      {onClick && (
        <i className="ti ti-chevron-right" style={{ fontSize: 16, color: "var(--ink-3)" }} aria-hidden="true" />
      )}
    </div>
  );
}
