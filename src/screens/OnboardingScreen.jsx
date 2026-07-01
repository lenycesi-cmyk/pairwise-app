import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useFinance } from "../context/FinanceContext";
import { CURRENCIES } from "../data/categories";
import { useTranslation } from "../hooks/useTranslation";

// Ordered list of onboarding step keys. Each new step just needs an entry
// here plus a render branch below — the progress dots and skip-all/continue
// plumbing are shared. Kept to a single step for now (currency); recurring
// expenses, income, bank account, assets and the feature tour land in
// follow-up PRs.
const STEPS = ["currency"];

export default function OnboardingScreen() {
  const t = useTranslation();
  const { completeOnboarding } = useAuth();
  const { defaultCurrency, updateDefaultCurrency } = useFinance();
  const [stepIndex, setStepIndex] = useState(0);
  const [currency, setCurrency] = useState(defaultCurrency);
  const [busy, setBusy] = useState(false);

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  async function goNext() {
    setBusy(true);
    try {
      if (step === "currency") {
        await updateDefaultCurrency(currency);
      }
      if (isLastStep) {
        await completeOnboarding();
      } else {
        setStepIndex((i) => i + 1);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={screenStyle}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 32 }}>
          {STEPS.map((s, i) => (
            <span
              key={s}
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: i <= stepIndex ? "var(--sky)" : "var(--rule)",
              }}
            />
          ))}
        </div>

        {step === "currency" && (
          <>
            <i className="ti ti-coin" style={{ fontSize: 40, color: "var(--tang)", marginBottom: 16, display: "block", textAlign: "center" }} aria-hidden="true" />
            <h1 style={{ fontSize: 22, marginBottom: 8, textAlign: "center" }}>
              {t("onboarding_currency_title")}
            </h1>
            <p style={{ fontSize: 14, color: "var(--ink-3)", marginBottom: 28, textAlign: "center" }}>
              {t("onboarding_currency_subtitle")}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 32 }}>
              {CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  onClick={() => setCurrency(c.code)}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "var(--radius-md)",
                    border: currency === c.code ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
                    background: currency === c.code ? "var(--sky-light)" : "var(--bg-card)",
                    color: currency === c.code ? "var(--sky)" : "var(--ink)",
                    fontSize: 14,
                    fontWeight: currency === c.code ? 500 : 400,
                  }}
                >
                  {c.symbol} {c.code}
                </button>
              ))}
            </div>
          </>
        )}

        <button
          onClick={goNext}
          disabled={busy}
          style={{
            background: "var(--ink)",
            color: "var(--bg)",
            border: "none",
            borderRadius: "var(--radius-md)",
            padding: 16,
            fontSize: 15,
            fontWeight: 500,
            width: "100%",
            marginBottom: 12,
            opacity: busy ? 0.6 : 1,
          }}
        >
          {isLastStep ? t("onboarding_finish") : t("onboarding_continue")}
        </button>
        <button
          onClick={completeOnboarding}
          disabled={busy}
          style={{
            background: "none",
            border: "none",
            fontSize: 13,
            color: "var(--ink-3)",
            width: "100%",
            textAlign: "center",
          }}
        >
          {t("onboarding_skip_all")}
        </button>
      </div>
    </div>
  );
}

const screenStyle = {
  minHeight: "100dvh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "2rem 1.5rem",
};
