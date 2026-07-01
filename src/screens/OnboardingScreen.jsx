import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useFinance } from "../context/FinanceContext";
import { useCategoryName } from "../hooks/useCategoryName";
import { CURRENCIES } from "../data/categories";
import { COMMON_RECURRING } from "../data/commonRecurring";
import { COMMON_INCOME } from "../data/commonIncome";
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
// plumbing are shared. Bank account, assets/debts and the feature tour land
// in follow-up PRs.
// No dedicated "pick a currency" step: every place currency actually gets
// used (recurring/income items here, transactions elsewhere in the app)
// already lets you choose it per entry, defaulting to whatever was last
// picked — forcing a single couple-wide choice upfront was redundant
// friction.
const STEPS = ["recurring", "income"];

// Local state + handlers for a chip-pick-then-fill-amount step (used for both
// recurring expenses and income). Selection is keyed by "categoryId::sub",
// value is { amount, currency }; presence of a key means the chip is picked.
function useQuickPick(lastCurrency, setLastCurrency) {
  const [selection, setSelection] = useState({});

  function toggle(key) {
    setSelection((prev) => {
      if (key in prev) {
        const { [key]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: { amount: "", currency: lastCurrency } };
    });
  }

  function setAmount(key, value) {
    setSelection((prev) => ({ ...prev, [key]: { ...prev[key], amount: value } }));
  }

  function setCurrency(key, value) {
    setLastCurrency(value);
    setSelection((prev) => ({ ...prev, [key]: { ...prev[key], currency: value } }));
  }

  return { selection, toggle, setAmount, setCurrency };
}

export default function OnboardingScreen() {
  const t = useTranslation();
  const { subName } = useCategoryName();
  const { user, coupleId, completeOnboarding } = useAuth();
  const { categories, recurringTx, defaultCurrency } = useFinance();
  const [stepIndex, setStepIndex] = useState(0);
  // Remembers the last currency picked across both quick-pick steps, so
  // newly selected chips default to it instead of always falling back to
  // defaultCurrency (mirrors the app's "last used currency" behavior).
  const [lastCurrency, setLastCurrency] = useState(defaultCurrency);
  const recurringPick = useQuickPick(lastCurrency, setLastCurrency);
  const incomePick = useQuickPick(lastCurrency, setLastCurrency);
  const [busy, setBusy] = useState(false);

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  function buildItems(selection, type) {
    return Object.entries(selection)
      .filter(([, { amount }]) => parseFloat(amount) > 0)
      .map(([key, { amount, currency }], i) => {
        const [categoryId, subcategory] = key.split("::");
        return {
          id: `rec_${Date.now()}_${type}_${i}`,
          type,
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
  }

  async function saveQuickPickStep(selection, type) {
    const items = buildItems(selection, type);
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
        await saveQuickPickStep(recurringPick.selection, "expense");
      } else if (step === "income") {
        await saveQuickPickStep(incomePick.selection, "income");
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

  function renderQuickPickStep({ icon, titleKey, subtitleKey, amountHintKey, items, pick }) {
    return (
      <>
        <i className={`ti ${icon}`} style={{ fontSize: 40, color: "var(--tang)", marginBottom: 16, display: "block", textAlign: "center" }} aria-hidden="true" />
        <h1 style={{ fontSize: 22, marginBottom: 8, textAlign: "center" }}>
          {t(titleKey)}
        </h1>
        <p style={{ fontSize: 14, color: "var(--ink-3)", marginBottom: 20, textAlign: "center" }}>
          {t(subtitleKey)}
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {items.map(({ categoryId, subcategory }) => {
            const cat = categories.find((c) => c.id === categoryId);
            if (!cat) return null;
            const key = `${categoryId}::${subcategory}`;
            const selected = key in pick.selection;
            const colors = COLOR_MAP[cat.color] || COLOR_MAP.tang;
            return (
              <button
                key={key}
                onClick={() => pick.toggle(key)}
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

        {Object.keys(pick.selection).length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 8 }}>
              {t(amountHintKey)}
            </p>
            {Object.entries(pick.selection).map(([key, { amount, currency }]) => {
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
                    onChange={(e) => pick.setAmount(key, e.target.value)}
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
                    onChange={(e) => pick.setCurrency(key, e.target.value)}
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
    );
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

        {step === "recurring" &&
          renderQuickPickStep({
            icon: "ti-repeat",
            titleKey: "onboarding_recurring_title",
            subtitleKey: "onboarding_recurring_subtitle",
            amountHintKey: "onboarding_recurring_amount_hint",
            items: COMMON_RECURRING,
            pick: recurringPick,
          })}

        {step === "income" &&
          renderQuickPickStep({
            icon: "ti-cash",
            titleKey: "onboarding_income_title",
            subtitleKey: "onboarding_income_subtitle",
            amountHintKey: "onboarding_income_amount_hint",
            items: COMMON_INCOME,
            pick: incomePick,
          })}

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
