import { useState, useEffect, useRef } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import AuthScreen from "./AuthScreen";
import CoupleSetupScreen from "./CoupleSetupScreen";
import OnboardingWelcome from "./onboarding/OnboardingWelcome";
import OnboardingAha from "./onboarding/OnboardingAha";
import OnboardingAccountType from "./onboarding/OnboardingAccountType";
import { Splash } from "./onboarding/onboardingUI";
import { onboardingT, detectOnboardingLanguage } from "../data/onboardingCopy";
import {
  loadDraft,
  loadMeta,
  saveMeta,
  loadOnbLang,
  saveOnbLang,
  guessDefaultCurrency,
} from "../utils/onboardingDraft";

function generateCoupleCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Orchestrateur de la phase PRÉ-couple de l'onboarding "valeur d'abord" :
// Accueil → Aha (brouillon local) → Solo/Couple → Sign-up. Une fois le compte
// créé (user présent, coupleId encore absent), crée l'espace couple à partir
// du brouillon/meta, ce qui fait basculer App vers la phase post-couple.
export default function OnboardingFlowPreCouple({ onSignIn }) {
  const { user, setCoupleId, setOnboardingComplete } = useAuth();
  const [lang, setLang] = useState(() => loadOnbLang() || detectOnboardingLanguage());
  const [step, setStep] = useState("welcome"); // welcome | aha | account | signup
  const creatingRef = useRef(false);

  function setLanguage(l) {
    setLang(l);
    saveOnbLang(l);
  }

  // Post-signup : compte créé mais pas encore d'espace couple → on le crée.
  // Le cas "join" (rejoindre le code d'un·e partenaire) est délégué à
  // CoupleSetupScreen, qui gère déjà tout le flux de jointure.
  useEffect(() => {
    if (!user || creatingRef.current) return;
    const meta = loadMeta();
    if (meta.accountType === "join") return;
    creatingRef.current = true;
    (async () => {
      const code = generateCoupleCode();
      await setDoc(
        doc(db, "couples", code),
        {
          createdAt: Date.now(),
          members: [{ uid: user.uid, memberId: user.uid, name: user.displayName || "Moi" }],
          memberUids: [user.uid],
          defaultCurrency: guessDefaultCurrency(),
          financeMode: "shared",
        },
        { merge: true }
      );
      await setDoc(
        doc(db, "users", user.uid),
        { coupleId: code, onboardingComplete: false },
        { merge: true }
      );
      setOnboardingComplete(false);
      setCoupleId(code);
    })();
  }, [user, setCoupleId, setOnboardingComplete]);

  if (user) {
    if (loadMeta().accountType === "join") return <CoupleSetupScreen />;
    return <Splash text={onboardingT(lang)("saving")} />;
  }

  if (step === "welcome")
    return (
      <OnboardingWelcome
        language={lang}
        onSetLanguage={setLanguage}
        onStart={() => setStep("aha")}
        onSignIn={onSignIn}
      />
    );
  if (step === "aha")
    return <OnboardingAha language={lang} onCreateAccount={() => setStep("account")} />;
  if (step === "account")
    return (
      <OnboardingAccountType
        language={lang}
        onPick={(type) => {
          saveMeta({ accountType: type });
          setStep("signup");
        }}
        onJoin={() => {
          saveMeta({ accountType: "join" });
          setStep("signup");
        }}
      />
    );
  // signup
  return (
    <AuthScreen defaultMode="signup" draftCount={loadDraft().length} onBack={() => setStep("account")} />
  );
}
