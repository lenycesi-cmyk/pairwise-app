import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useFinance } from "../context/FinanceContext";
import OnboardingShareMode from "./onboarding/OnboardingShareMode";
import OnboardingInvite from "./onboarding/OnboardingInvite";
import { Splash } from "./onboarding/onboardingUI";
import { onboardingT } from "../data/onboardingCopy";
import { loadDraft, clearDraft, loadMeta, clearMeta, loadOnbLang } from "../utils/onboardingDraft";

// Orchestrateur de la phase POST-couple (monté dans FinanceProvider, coupleId
// présent) : migre le brouillon local vers Firestore, puis — si couple —
// propose le mode de partage et l'invitation, avant de clôturer l'onboarding.
export default function OnboardingFlowPostCouple() {
  const { user, coupleId, completeOnboarding } = useAuth();
  const { addTransaction, updateFinanceMode } = useFinance();
  const lang = loadOnbLang() || "fr";
  const meta = loadMeta();
  const isCouple = meta.accountType === "couple";

  const [migrated, setMigrated] = useState(false);
  const [step, setStep] = useState(isCouple ? "mode" : "finalizing");
  const migRef = useRef(false);

  // Migration du brouillon (une seule fois).
  useEffect(() => {
    if (migRef.current) return;
    migRef.current = true;
    (async () => {
      const draft = loadDraft();
      for (const e of draft) {
        try {
          await addTransaction({
            type: e.type,
            amount: e.amount,
            currency: e.currency,
            categoryId: e.categoryId,
            subcategory: e.subcategory,
            description: e.description,
            date: e.date,
            tags: e.tags || [],
            paidBy: user?.uid,
            split: "100",
          });
        } catch {
          /* on n'interrompt pas la migration sur une ligne fautive */
        }
      }
      clearDraft();
      setMigrated(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Solo : une fois la migration faite, on clôture directement.
  useEffect(() => {
    if (!isCouple && migrated && step === "finalizing") {
      clearMeta();
      completeOnboarding();
    }
  }, [isCouple, migrated, step, completeOnboarding]);

  if (step === "mode")
    return (
      <OnboardingShareMode
        language={lang}
        onPick={async (mode) => {
          await updateFinanceMode(mode);
          setStep("invite");
        }}
      />
    );

  if (step === "invite")
    return (
      <OnboardingInvite
        language={lang}
        coupleCode={coupleId}
        onDone={() => {
          clearMeta();
          completeOnboarding();
        }}
      />
    );

  return <Splash text={onboardingT(lang)("saving")} />;
}
