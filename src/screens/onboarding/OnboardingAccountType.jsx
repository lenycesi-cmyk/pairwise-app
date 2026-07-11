import { onboardingT } from "../../data/onboardingCopy";
import { SetupGauge, ChoiceCard } from "./onboardingUI";
import { screenWrap, scrollArea, displayTitle } from "./onboardingStyles";

// Écran 3 · Solo ou couple ? Choix réversible, jauge "jamais à 0 %" (55 %).
export default function OnboardingAccountType({ language, onPick, onJoin }) {
  const t = onboardingT(language);
  return (
    <div style={screenWrap}>
      <SetupGauge pct={55} label={t("gauge")} />
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
