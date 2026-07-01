import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useFinance } from "../context/FinanceContext";
import { useCategoryName } from "../hooks/useCategoryName";
import { CURRENCIES } from "../data/categories";
import { COMMON_RECURRING } from "../data/commonRecurring";
import { COMMON_INCOME } from "../data/commonIncome";
import { COMMON_INVESTMENT } from "../data/commonInvestment";
import { useTranslation } from "../hooks/useTranslation";
import ConnectBankButton from "../components/ConnectBankButton";
import { ASSET_TYPES } from "../data/assetTypes";

// Every asset type except "account" — that one's handled by the dedicated
// bank_account step already.
const POSSESSION_TYPES = ASSET_TYPES.filter((t) => t.id !== "account");

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
// plumbing are shared. The feature tour lands in a follow-up PR.
// No dedicated "pick a currency" step: every place currency actually gets
// used (recurring/income/investment/possession items here, transactions
// elsewhere in the app) already lets you choose it per entry, defaulting to
// whatever was last picked — forcing a single couple-wide choice upfront
// was redundant friction.
const STEPS = ["recurring", "income", "investment", "bank_account", "possessions"];

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
  const { categories, recurringTx, assets, defaultCurrency, language } = useFinance();
  const [stepIndex, setStepIndex] = useState(0);
  // Remembers the last currency picked across every step, so newly selected
  // chips (or the bank account form) default to it instead of always
  // falling back to defaultCurrency (mirrors the app's "last used currency"
  // behavior).
  const [lastCurrency, setLastCurrency] = useState(defaultCurrency);
  const recurringPick = useQuickPick(lastCurrency, setLastCurrency);
  const incomePick = useQuickPick(lastCurrency, setLastCurrency);
  const investmentPick = useQuickPick(lastCurrency, setLastCurrency);
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankAccountBalance, setBankAccountBalance] = useState("");
  // Accounts created so far this step (multiple sources of income can land
  // on different accounts — salary here, rental income there). Each entry
  // is the asset object as written to Firestore, so it has a known id
  // before ConnectBankButton can target it (Plaid's exchange step writes
  // the connection back onto that specific asset id).
  const [bankAccounts, setBankAccounts] = useState([]);
  const [showAccountForm, setShowAccountForm] = useState(true);
  // "What do you own/owe" step: one form covers every asset type (accounts,
  // investments, real estate, debts, valuables...) except bank accounts,
  // which already have their own step — a type picker instead of separate
  // screens per category avoids repeating the same three fields three times.
  const [possessionType, setPossessionType] = useState(POSSESSION_TYPES[0].id);
  const [possessionName, setPossessionName] = useState("");
  const [possessionValue, setPossessionValue] = useState("");
  const [possessions, setPossessions] = useState([]);
  const [showPossessionForm, setShowPossessionForm] = useState(true);
  const [busy, setBusy] = useState(false);

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  function goBack() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

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
          // Attributed entirely to whoever is doing onboarding, not "50/50".
          // At this point a partner may not have joined yet (their uid isn't
          // even known), and even once they do, a salary or personal
          // investment has no reason to default to a 50/50 split the way a
          // shared rent payment might — that's a couple-specific choice best
          // made later in Recurring, not guessed here.
          split: user.uid,
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

  // Separate from goNext: creating the account happens on its own button so
  // the just-created asset (with a known id) can be handed to
  // ConnectBankButton without waiting for a step transition. Bases the write
  // on assets + bankAccounts (not just assets) so accounts added earlier in
  // this same step aren't lost — context's `assets` won't reflect them yet
  // since the Firestore listener hasn't caught up.
  async function createBankAccount() {
    setBusy(true);
    try {
      const asset = {
        id: `asset_${Date.now()}`,
        typeId: "account",
        name: bankAccountName.trim() || `${t("onboarding_bank_account_fallback_name")}${bankAccounts.length > 0 ? ` ${bankAccounts.length + 1}` : ""}`,
        currency: lastCurrency,
        value: parseFloat(bankAccountBalance) || 0,
        ownership: user.uid,
        sharePct: 100,
        sharePctDetails: null,
        createdAt: Date.now(),
        lastUpdated: Date.now(),
      };
      await setDoc(
        doc(db, "couples", coupleId),
        { assets: [...assets, ...bankAccounts, asset] },
        { merge: true }
      );
      setBankAccounts((prev) => [...prev, asset]);
      setBankAccountName("");
      setBankAccountBalance("");
      setShowAccountForm(false);
    } finally {
      setBusy(false);
    }
  }

  // Same pattern as createBankAccount: writes directly (not addAsset()) so
  // multiple possessions added in this step accumulate instead of
  // overwriting each other, basing the write on assets + bankAccounts +
  // possessions already added this session.
  async function createPossession() {
    if (!possessionName.trim() || !possessionValue) return;
    setBusy(true);
    try {
      const type = ASSET_TYPES.find((t2) => t2.id === possessionType);
      const asset = {
        id: `asset_${Date.now()}`,
        typeId: possessionType,
        name: possessionName.trim(),
        currency: lastCurrency,
        value: Math.abs(parseFloat(possessionValue)) || 0,
        ownership: user.uid,
        sharePct: 100,
        sharePctDetails: null,
        createdAt: Date.now(),
        lastUpdated: Date.now(),
      };
      await setDoc(
        doc(db, "couples", coupleId),
        { assets: [...assets, ...bankAccounts, ...possessions, asset] },
        { merge: true }
      );
      setPossessions((prev) => [...prev, { ...asset, typeIcon: type?.icon, typeColor: type?.color }]);
      setPossessionName("");
      setPossessionValue("");
      setShowPossessionForm(false);
    } finally {
      setBusy(false);
    }
  }

  async function goNext() {
    setBusy(true);
    try {
      if (step === "recurring") {
        await saveQuickPickStep(recurringPick.selection, "expense");
      } else if (step === "income") {
        await saveQuickPickStep(incomePick.selection, "income");
      } else if (step === "investment") {
        await saveQuickPickStep(investmentPick.selection, "investment");
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
          <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 32px", alignItems: "center", marginBottom: 32 }}>
            {stepIndex > 0 ? (
              <button
                onClick={goBack}
                disabled={busy}
                aria-label={t("onboarding_back")}
                style={{ background: "none", border: "none", color: "var(--ink-3)", justifySelf: "start" }}
              >
                <i className="ti ti-chevron-left" style={{ fontSize: 20 }} aria-hidden="true" />
              </button>
            ) : <span />}
            <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
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
            <span />
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

        {step === "investment" &&
          renderQuickPickStep({
            icon: "ti-chart-line",
            titleKey: "onboarding_investment_title",
            subtitleKey: "onboarding_investment_subtitle",
            amountHintKey: "onboarding_investment_amount_hint",
            items: COMMON_INVESTMENT,
            pick: investmentPick,
          })}

        {step === "bank_account" && (
          <>
            <i className="ti ti-building-bank" style={{ fontSize: 40, color: "var(--tang)", marginBottom: 16, display: "block", textAlign: "center" }} aria-hidden="true" />
            <h1 style={{ fontSize: 22, marginBottom: 8, textAlign: "center" }}>
              {t("onboarding_bank_account_title")}
            </h1>
            <p style={{ fontSize: 14, color: "var(--ink-3)", marginBottom: 20, textAlign: "center" }}>
              {t("onboarding_bank_account_subtitle")}
            </p>

            {bankAccounts.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                {bankAccounts.map((acc) => (
                  <div key={acc.id} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: "var(--radius-md)", background: "var(--sage-light)", marginBottom: 8 }}>
                      <i className="ti ti-check" style={{ fontSize: 16, color: "var(--sage)" }} aria-hidden="true" />
                      <span style={{ fontSize: 13, color: "var(--sage)" }}>{acc.name}</span>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 8, textAlign: "center" }}>
                      {t("onboarding_bank_connect_hint")}
                    </p>
                    <ConnectBankButton
                      asset={assets.find((a) => a.id === acc.id) || acc}
                      onSuccess={() => {}}
                    />
                  </div>
                ))}
              </div>
            )}

            {showAccountForm ? (
              <div style={{ marginBottom: 28 }}>
                <input
                  type="text"
                  placeholder={t("onboarding_bank_account_name_placeholder")}
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "var(--radius-md)",
                    border: "0.5px solid var(--rule)",
                    fontSize: 14,
                    marginBottom: 10,
                    outline: "none",
                  }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder={t("onboarding_bank_account_balance_placeholder")}
                    value={bankAccountBalance}
                    onChange={(e) => setBankAccountBalance(e.target.value)}
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "0.5px solid var(--rule)",
                      fontSize: 14,
                      outline: "none",
                    }}
                  />
                  <select
                    value={lastCurrency}
                    onChange={(e) => setLastCurrency(e.target.value)}
                    style={{
                      padding: "10px 6px",
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
                <button
                  onClick={createBankAccount}
                  disabled={busy}
                  style={{
                    width: "100%",
                    padding: 14,
                    borderRadius: "var(--radius-md)",
                    border: "0.5px solid var(--sky)",
                    background: "var(--sky-light)",
                    color: "var(--sky)",
                    fontSize: 14,
                    fontWeight: 500,
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  {t("onboarding_bank_account_create")}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAccountForm(true)}
                disabled={busy}
                style={{
                  width: "100%",
                  padding: 12,
                  marginBottom: 28,
                  borderRadius: "var(--radius-md)",
                  border: "0.5px dashed var(--rule)",
                  background: "none",
                  color: "var(--ink-2)",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <i className="ti ti-plus" style={{ fontSize: 14 }} aria-hidden="true" />
                {t("onboarding_bank_account_add_another")}
              </button>
            )}
          </>
        )}

        {step === "possessions" && (
          <>
            <i className="ti ti-briefcase" style={{ fontSize: 40, color: "var(--tang)", marginBottom: 16, display: "block", textAlign: "center" }} aria-hidden="true" />
            <h1 style={{ fontSize: 22, marginBottom: 8, textAlign: "center" }}>
              {t("onboarding_possessions_title")}
            </h1>
            <p style={{ fontSize: 14, color: "var(--ink-3)", marginBottom: 20, textAlign: "center" }}>
              {t("onboarding_possessions_subtitle")}
            </p>

            {possessions.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                {possessions.map((p) => {
                  const colors = COLOR_MAP[p.typeColor] || COLOR_MAP.tang;
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 12px", borderRadius: "var(--radius-md)",
                        border: "0.5px solid var(--rule)", marginBottom: 8,
                      }}
                    >
                      <div style={{ width: 30, height: 30, borderRadius: "var(--radius-md)", background: colors.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <i className={`ti ${p.typeIcon}`} style={{ fontSize: 14, color: colors.text }} aria-hidden="true" />
                      </div>
                      <span style={{ fontSize: 13, flex: 1, minWidth: 0 }}>{p.name}</span>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>
                        {Math.round(p.value).toLocaleString("fr-FR")} {p.currency}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {showPossessionForm ? (
              <div style={{ marginBottom: 28 }}>
                <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>
                  {t("onboarding_possessions_type_label")}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {POSSESSION_TYPES.map((type) => {
                    const colors = COLOR_MAP[type.color] || COLOR_MAP.tang;
                    const selected = possessionType === type.id;
                    return (
                      <button
                        key={type.id}
                        onClick={() => setPossessionType(type.id)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "var(--radius-md)",
                          border: selected ? `0.5px solid ${colors.text}` : "0.5px solid var(--rule)",
                          background: selected ? colors.bg : "var(--bg-card)",
                          color: selected ? colors.text : "var(--ink)",
                          fontSize: 12,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <i className={`ti ${type.icon}`} style={{ fontSize: 13 }} aria-hidden="true" />
                        {language === "en" && type.nameEn ? type.nameEn : type.name}
                      </button>
                    );
                  })}
                </div>

                <input
                  type="text"
                  placeholder={t("onboarding_possessions_name_placeholder")}
                  value={possessionName}
                  onChange={(e) => setPossessionName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "var(--radius-md)",
                    border: "0.5px solid var(--rule)",
                    fontSize: 14,
                    marginBottom: 10,
                    outline: "none",
                  }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder={t("onboarding_possessions_value_placeholder")}
                    value={possessionValue}
                    onChange={(e) => setPossessionValue(e.target.value)}
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "0.5px solid var(--rule)",
                      fontSize: 14,
                      outline: "none",
                    }}
                  />
                  <select
                    value={lastCurrency}
                    onChange={(e) => setLastCurrency(e.target.value)}
                    style={{
                      padding: "10px 6px",
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
                <button
                  onClick={createPossession}
                  disabled={busy || !possessionName.trim() || !possessionValue}
                  style={{
                    width: "100%",
                    padding: 14,
                    borderRadius: "var(--radius-md)",
                    border: "0.5px solid var(--sky)",
                    background: "var(--sky-light)",
                    color: "var(--sky)",
                    fontSize: 14,
                    fontWeight: 500,
                    opacity: busy || !possessionName.trim() || !possessionValue ? 0.6 : 1,
                  }}
                >
                  {t("onboarding_possessions_add")}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowPossessionForm(true)}
                disabled={busy}
                style={{
                  width: "100%",
                  padding: 12,
                  marginBottom: 28,
                  borderRadius: "var(--radius-md)",
                  border: "0.5px dashed var(--rule)",
                  background: "none",
                  color: "var(--ink-2)",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <i className="ti ti-plus" style={{ fontSize: 14 }} aria-hidden="true" />
                {t("onboarding_possessions_add_another")}
              </button>
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
