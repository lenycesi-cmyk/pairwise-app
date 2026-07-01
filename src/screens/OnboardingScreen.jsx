import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useFinance } from "../context/FinanceContext";
import { useCategoryName } from "../hooks/useCategoryName";
import { CURRENCIES } from "../data/categories";
import { COMMON_RECURRING } from "../data/commonRecurring";
import { useTranslation } from "../hooks/useTranslation";

const COLOR_MAP = {
  tang: { text: "var(--tang)", bg: "var(--tang-light)" },
  sage: { text: "var(--sage)", bg: "var(--sage-light)" },
  lavi: { text: "var(--lavi)", bg: "var(--lavi-light)" },
  sky: { text: "var(--sky)", bg: "var(--sky-light)" },
  amber: { text: "var(--amber)", bg: "var(--amber-light)" },
  mint: { text: "var(--mint)", bg: "var(--mint-light)" },
  blush: { text: "var(--blush)", bg: "var(--blush-light)" },
};

// Ordered list of onboarding step keys. Each new step just needs an entry
// here plus a render branch below — the progress dots and skip-all/continue
// plumbing are shared. Income, bank account, assets and the feature tour
// land in follow-up PRs.
// No dedicated "pick a currency" step: every place currency actually gets
// used (recurring items here, transactions elsewhere in the app) already
// lets you choose it per entry, defaulting to whatever was last picked —
// forcing a single couple-wide choice upfront was redundant friction.
const STEPS = ["recurring"];

export default function OnboardingScreen() {
  const t = useTranslation();
  const { subName } = useCategoryName();
  const { user, coupleId, completeOnboarding } = useAuth();
  const { categories, recurringTx, defaultCurrency } = useFinance();
  const [stepIndex, setStepIndex] = useState(0);
  // Remembers the last currency picked for a recurring item, so newly
  // selected chips default to it instead of always falling back to
  // defaultCurrency (mirrors the app's "last used currency" behavior).
  const [lastCurrency, setLastCurrency] = useState(defaultCurrency);
  // Map of "categoryId::subcategory" -> { amount, currency }, for the
  // recurring step. Presence of a key means the chip is selected; the
  // amount can stay empty while selected (that item is just skipped at
  // save time).
  const [recurringSelection, setRecurringSelection] = useState({});
  const [busy, setBusy] = useState(false);

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  function toggleRecurringItem(key) {
    setRecurringSelection((prev) => {
      if (key in prev) {
        const { [key]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: { amount: "", currency: lastCurrency } };
    });
  }

  function setRecurringAmount(key, value) {
    setRecurringSelection((prev) => ({ ...prev, [key]: { ...prev[key], amount: value } }));
  }

  function setRecurringCurrency(key, value) {
    setLastCurrency(value);
    setRecurringSelection((prev) => ({ ...prev, [key]: { ...prev[key], currency: value } }));
  }

  async function saveRecurringSelection() {
    const items = Object.entries(recurringSelection)
      .filter(([, { amount }]) => parseFloat(amount) > 0)
      .map(([key, { amount, currency }], i) => {
        const [categoryId, subcategory] = key.split("::");
        return {
          id: `rec_${Date.now()}_${i}`,
          type: "expense",
          amount: parseFloat(amount),
          currency,
          categoryId,
          subcategory,
          description: subName(subcategory, categoryId),
          frequency: "monthly",
          dayOfMonth: 1,
          paidBy: user.uid,
          split: "50/50",
          active: true,
          lastGenerated: null,
        };
      });
    if (items.length === 0) return;
    // Bulk write instead of calling addRecurring per item — that hook reads
    // the current recurringTx array from context state, so several calls in
    // a row without waiting for a re-render would each overwrite the last
    // instead of accumulating.
    await setDoc(
      doc(db, "couples", coupleId),
      { recurringTx: [...recurringTx, ...items] },
      { merge: true }
    );
  }

  async function goNext() {
    setBusy(true);
    try {
      if (step === "recurring") {
        await saveRecurringSelection();
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
        {STEPS.length > 1 && (
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
        )}

        {step === "recurring" && (
          <>
            <i className="ti ti-repeat" style={{ fontSize: 40, color: "var(--tang)", marginBottom: 16, display: "block", textAlign: "center" }} aria-hidden="true" />
            <h1 style={{ fontSize: 22, marginBottom: 8, textAlign: "center" }}>
              {t("onboarding_recurring_title")}
            </h1>
            <p style={{ fontSize: 14, color: "var(--ink-3)", marginBottom: 20, textAlign: "center" }}>
              {t("onboarding_recurring_subtitle")}
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              {COMMON_RECURRING.map(({ categoryId, subcategory }) => {
                const cat = categories.find((c) => c.id === categoryId);
                if (!cat) return null;
                const key = `${categoryId}::${subcategory}`;
                const selected = key in recurringSelection;
                const colors = COLOR_MAP[cat.color] || COLOR_MAP.tang;
                return (
                  <button
                    key={key}
                    onClick={() => toggleRecurringItem(key)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                      border: selected ? `0.5px solid ${colors.text}` : "0.5px solid var(--rule)",
                      background: selected ? colors.bg : "var(--bg-card)",
                      color: selected ? colors.text : "var(--ink)",
                      fontSize: 13,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <i className={`ti ${cat.icon}`} style={{ fontSize: 14 }} aria-hidden="true" />
                    {subName(subcategory, categoryId)}
                  </button>
                );
              })}
            </div>

            {Object.keys(recurringSelection).length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 8 }}>
                  {t("onboarding_recurring_amount_hint")}
                </p>
                {Object.entries(recurringSelection).map(([key, { amount, currency }]) => {
                  const [categoryId, subcategory] = key.split("::");
                  return (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 13, flex: 1, minWidth: 0 }}>
                        {subName(subcategory, categoryId)}
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder="0"
                        value={amount}
                        onChange={(e) => setRecurringAmount(key, e.target.value)}
                        style={{
                          width: 80,
                          padding: "8px 10px",
                          borderRadius: "var(--radius-md)",
                          border: "0.5px solid var(--rule)",
                          fontSize: 14,
                          outline: "none",
                        }}
                      />
                      <select
                        value={currency}
                        onChange={(e) => setRecurringCurrency(key, e.target.value)}
                        style={{
                          padding: "8px 6px",
                          borderRadius: "var(--radius-md)",
                          border: "0.5px solid var(--rule)",
                          fontSize: 13,
                          background: "var(--bg-card)",
                        }}
                      >
                        {CURRENCIES.map((c) => (
                          <option key={c.code} value={c.code}>{c.code}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            )}
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
  overflowY: "auto",
};
