import { onboardingT } from "../../data/onboardingCopy";
import { SetupGauge, ChoiceCard, BackBar } from "./onboardingUI";
import { screenWrap, scrollArea, displayTitle } from "./onboardingStyles";

// Écran 2 · Solo ou couple ? Choix réversible, jauge "jamais à 0 %" (80 %).
export default function OnboardingAccountType({ language, onPick, onJoin, onBack }) {
  const t = onboardingT(language);
  return (
    <div style={screenWrap}>
      <BackBar onBack={onBack} />
      <SetupGauge pct={80} label={t("gauge")} />
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

        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, color: "var(--ink-3)", fontSize: 12.5, marginTop: 18 }}>
          <i className="ti ti-refresh" style={{ fontSize: 14 }} />
          {t("s4_rev")}
        </div>
        <button
          onClick={onJoin}
          style={{ background: "none", border: "none", color: "var(--sky)", fontWeight: 700, fontSize: 13, cursor: "pointer", marginTop: 14, fontFamily: "inherit" }}
        >
          {t("s4_join")}
        </button>
      </div>
    </div>
  );
}
