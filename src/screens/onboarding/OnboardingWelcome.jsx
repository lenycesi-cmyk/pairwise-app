import { useEffect, useState } from "react";
import { onboardingT } from "../../data/onboardingCopy";
import { BrandRow } from "./onboardingUI";
import { screenWrap, primaryBtn, displayTitle } from "./onboardingStyles";

const EXAMPLES = {
  fr: ["15€ déjeuner hier", "42,50 courses", "un café 3€", "80€ essence samedi"],
  en: ["$15 lunch yesterday", "42.50 groceries", "a coffee $3", "$80 gas saturday"],
};

// Écran 1 · Accueil — donner envie de saisir une 1ʳᵉ dépense, sans compte.
export default function OnboardingWelcome({ language, onSetLanguage, onStart, onSignIn }) {
  const t = onboardingT(language);
  const examples = EXAMPLES[language === "en" ? "en" : "fr"];
  const [i, setI] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setI((n) => (n + 1) % examples.length), 2600);
    return () => clearInterval(iv);
  }, [examples.length]);

  return (
    <div style={screenWrap}>
      <div style={{ flex: 1, overflowY: "auto", padding: "26px 22px 22px", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <BrandRow />
          <div style={{ display: "flex", background: "var(--bg-card)", border: "0.5px solid var(--rule)", borderRadius: 999, padding: 3 }}>
            {["fr", "en"].map((lg) => (
              <button
                key={lg}
                onClick={() => onSetLanguage(lg)}
                style={{
                  border: "none",
                  borderRadius: 999,
                  padding: "5px 11px",
                  fontFamily: "inherit",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  background: language === lg ? "var(--ink)" : "transparent",
                  color: language === lg ? "var(--bg)" : "var(--ink-3)",
                }}
              >
                {lg.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignSelf: "flex-start",
            alignItems: "center",
            gap: 7,
            background: "var(--sage-light)",
            color: "var(--sage)",
            borderRadius: 999,
            padding: "6px 12px",
            fontSize: 11.5,
            fontWeight: 600,
            margin: "8px 0 20px",
            lineHeight: 1.3,
          }}
        >
          <i className="ti ti-lock" style={{ fontSize: 13 }} />
          <span>{t("s1_kicker")}</span>
        </div>

        <h1 style={displayTitle}>
          {t("s1_t1")}
          <br />
          <span style={{ color: "var(--ink-3)" }}>{t("s1_t2")}</span>
        </h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.5, color: "var(--ink-2)", margin: "0 0 26px" }}>
          {t("s1_sub")}
        </p>

        <div
          style={{
            background: "var(--bg-card)",
            border: "1.5px solid var(--tang)",
            borderRadius: 17,
            padding: 16,
            boxShadow: "0 8px 22px var(--tang-light)",
            display: "flex",
            alignItems: "center",
            gap: 11,
            marginBottom: 14,
          }}
        >
          <i className="ti ti-sparkles" style={{ color: "var(--tang)", fontSize: 20, flex: "none" }} />
          <div style={{ flex: 1, fontSize: 15, fontWeight: 500, minHeight: 20 }}>
            {examples[i]}
            <span
              style={{
                display: "inline-block",
                width: 2,
                height: 15,
                background: "var(--tang)",
                marginLeft: 1,
                verticalAlign: "-2px",
                animation: "pw-blink 1.05s steps(1) infinite",
              }}
            />
          </div>
        </div>

        <button onClick={onStart} style={primaryBtn}>
          {t("s1_cta")}
          <i className="ti ti-arrow-right" style={{ fontSize: 17 }} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{t("s1_try")}</span>
          {examples.slice(0, 3).map((ex) => (
            <span
              key={ex}
              style={{
                fontSize: 12,
                color: "var(--ink-2)",
                background: "var(--bg-card)",
                border: "0.5px solid var(--rule)",
                borderRadius: 999,
                padding: "4px 10px",
              }}
            >
              {ex}
            </span>
          ))}
        </div>

        <div style={{ flex: 1 }} />
        <div style={{ textAlign: "center", fontSize: 13, color: "var(--ink-3)", paddingTop: 16 }}>
          {t("s1_signin")}{" "}
          <button
            onClick={onSignIn}
            style={{ background: "none", border: "none", fontWeight: 700, color: "var(--sky)", cursor: "pointer", fontSize: 13 }}
          >
            {t("s1_signinCta")}
          </button>
        </div>
      </div>
    </div>
  );
}
