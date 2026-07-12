import { useState, useEffect, useRef } from "react";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import AuthScreen from "./AuthScreen";
import CoupleSetupScreen from "./CoupleSetupScreen";
import OnboardingEntry from "./onboarding/OnboardingEntry";
import OnboardingAccountType from "./onboarding/OnboardingAccountType";
import OnboardingShareMode from "./onboarding/OnboardingShareMode";
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
// Saisie langage naturel + Aha → Solo/Couple → (Mode de partage si couple) →
// Sign-up. Une fois le compte créé (user présent, coupleId absent), crée
// l'espace couple à partir du brouillon/meta.
export default function OnboardingFlowPreCouple({ onSignIn }) {
  const { user, setCoupleId, setOnboardingComplete } = useAuth();
  // Langue détectée depuis le navigateur (pas de sélecteur à l'écran). On la
  // mémorise pour que la phase post-couple (migration, invitation) l'utilise.
  const [lang] = useState(() => loadOnbLang() || detectOnboardingLanguage());
  const [step, setStep] = useState("entry"); // entry | account | mode | signup
  const creatingRef = useRef(false);

  useEffect(() => {
    saveOnbLang(lang);
  }, [lang]);

  // Post-signup : compte créé mais pas encore d'espace couple → on le crée.
  // Le cas "join" est délégué à CoupleSetupScreen (flux de jointure existant).
  useEffect(() => {
    if (!user || creatingRef.current) return;
    const meta = loadMeta();
    if (meta.accountType === "join") return;
    creatingRef.current = true;
    (async () => {
      // GARDE-FOU ANTI-PERTE DE DONNÉES. Un compte EXISTANT peut retomber dans
      // ce flux le temps que son coupleId se charge (ex. « Se connecter » depuis
      // l'accueil : `user` devient vrai avant que le coupleId revienne de
      // Firestore, et cet écran est monté pendant ce court instant). Sans ce
      // contrôle, on créait un tout nouveau couple vide et on écrasait le
      // pointeur users/{uid}.coupleId — « orphelinant » l'espace couple existant
      // (transactions, patrimoine, budgets…). On relit donc le doc user AVANT de
      // créer : s'il a déjà un coupleId, on l'adopte au lieu d'en créer un.
      const existing = await getDoc(doc(db, "users", user.uid));
      if (existing.exists() && existing.data().coupleId) {
        setOnboardingComplete(existing.data().onboardingComplete !== false);
        setCoupleId(existing.data().coupleId);
        return;
      }
      const code = generateCoupleCode();
      await setDoc(
        doc(db, "couples", code),
        {
          createdAt: Date.now(),
          members: [{ uid: user.uid, memberId: user.uid, name: user.displayName || "Moi" }],
          memberUids: [user.uid],
          defaultCurrency: guessDefaultCurrency(),
          financeMode: meta.shareMode || "shared",
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

  if (step === "entry")
    return (
      <OnboardingEntry
        language={lang}
        onSignIn={onSignIn}
        onNext={() => setStep("account")}
      />
    );

  if (step === "account")
    return (
      <OnboardingAccountType
        language={lang}
        onBack={() => setStep("entry")}
        onPick={(type) => {
          saveMeta({ accountType: type });
          setStep(type === "couple" ? "mode" : "signup");
        }}
        onJoin={() => {
          saveMeta({ accountType: "join" });
          setStep("signup");
        }}
      />
    );

  if (step === "mode")
    return (
      <OnboardingShareMode
        language={lang}
        onBack={() => setStep("account")}
        onPick={(mode) => {
          saveMeta({ shareMode: mode });
          setStep("signup");
        }}
      />
    );

  // signup
  const isCouple = loadMeta().accountType === "couple";
  return (
    <AuthScreen
      defaultMode="signup"
      draft={loadDraft()}
      language={lang}
      onBack={() => setStep(isCouple ? "mode" : "account")}
    />
  );
}
