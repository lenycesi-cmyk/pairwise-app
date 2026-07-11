import { useState } from "react";
import { onboardingT } from "../../data/onboardingCopy";
import { StepDots } from "./onboardingUI";
import { screenWrap, scrollArea, primaryBtn, displayTitle } from "./onboardingStyles";

// Écran 6 · Inviter le/la partenaire (si couple). Code du couple + copie du
// lien. Non bloquant : "Plus tard" termine aussi l'onboarding.
export default function OnboardingInvite({ language, coupleCode, onDone }) {
  const t = onboardingT(language);
  const [copied, setCopied] = useState(false);
  const link = `https://pairwise.app/join/${coupleCode}`;

  function copy() {
    try {
      navigator.clipboard.writeText(link);
    } catch {
      /* ignore */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div style={screenWrap}>
      <StepDots current={3} total={3} label={t("step")} />
      <div style={{ ...scrollArea, alignItems: "center", textAlign: "center" }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "var(--lavi-light)",
            color: "var(--lavi)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <i className="ti ti-user-plus" style={{ fontSize: 28 }} />
        </div>
        <h1 style={{ ...displayTitle, textAlign: "center" }}>{t("s7_t")}</h1>
        <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--ink-2)", margin: "0 0 22px", maxWidth: 320 }}>
          {t("s7_sub")}
        </p>

        <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-3)", marginBottom: 8 }}>
          {t("s7_code")}
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 36,
            fontWeight: 600,
            letterSpacing: 6,
            color: "var(--lavi)",
            background: "var(--bg-card)",
            border: "0.5px solid var(--rule)",
            borderRadius: "var(--radius-lg)",
            padding: "16px 24px",
            marginBottom: 18,
          }}
        >
          {coupleCode}
        </div>

        <button
          onClick={copy}
          style={{ ...primaryBtn, background: copied ? "var(--sage)" : "var(--lavi)", maxWidth: 320 }}
        >
          <i className={`ti ${copied ? "ti-check" : "ti-link"}`} style={{ fontSize: 17 }} />
          {copied ? t("s7_copied") : t("s7_copy")}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--ink-3)", fontSize: 12.5, margin: "18px 0" }}>
          <i className="ti ti-clock" style={{ fontSize: 14 }} />
          {t("s7_anytime")}
        </div>

        <div style={{ flex: 1 }} />
        <button
          onClick={onDone}
          style={{ background: "var(--ink)", color: "var(--bg)", border: "none", borderRadius: "var(--radius-md)", padding: 15, fontSize: 15, fontWeight: 600, width: "100%", maxWidth: 320, cursor: "pointer", fontFamily: "inherit" }}
        >
          {t("s7_done")}
        </button>
        <button
          onClick={onDone}
          style={{ background: "none", border: "none", color: "var(--ink-3)", fontSize: 13, cursor: "pointer", marginTop: 12, fontFamily: "inherit" }}
        >
          {t("s7_later")}
        </button>
      </div>
    </div>
  );
}
