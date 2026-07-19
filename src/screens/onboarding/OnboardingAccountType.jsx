import { onboardingT } from "../../data/onboardingCopy";
import { StepDots, ChoiceCard } from "./onboardingUI";
import { screenWrap, scrollArea, displayTitle } from "./onboardingStyles";

// Écran 2 · Solo ou couple ? Choix réversible (dernière étape : 3/3).
export default function OnboardingAccountType({ language, onPick, onJoin, onBack }) {
  const t = onboardingT(language);
  return (
    <div style={screenWrap}>
      <StepDots current={3} total={3} label={t("step")} onBack={onBack} />
      <div style={scrollArea}>
        <h1 style={displayTitle}>{t("s4_t")}</h1>
        <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--ink-2)", margin: "0 0 24px" }}>
          {t("s4_sub")}
        </p>

        <ChoiceCard
          icon="ti-user"
          iconColor="--sky"
          title={t("s4_solo_t")}
          body={t("s4_solo_b")}
          onClick={() => onPick("solo")}
        />
        <ChoiceCard
          icon="ti-users"
          iconColor="--lavi"
          title={t("s4_cpl_t")}
          body={t("s4_cpl_b")}
          selected
          onClick={() => onPick("couple")}
        />

        <button
          onClick={onJoin}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", background: "none", border: "none", color: "var(--sky)", fontWeight: 700, fontSize: 15, cursor: "pointer", marginTop: 16, padding: "6px 0", fontFamily: "inherit" }}
        >
          <i className="ti ti-ticket" style={{ fontSize: 18 }} aria-hidden="true" />
          {t("s4_join")}
        </button>

        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, color: "var(--ink-3)", fontSize: 12.5, marginTop: 18 }}>
          <i className="ti ti-refresh" style={{ fontSize: 14 }} />
          {t("s4_rev")}
        </div>
      </div>
    </div>
  );
}
