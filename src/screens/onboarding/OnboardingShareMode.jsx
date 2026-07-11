import { onboardingT } from "../../data/onboardingCopy";
import { SetupGauge, ChoiceCard, BackBar } from "./onboardingUI";
import { screenWrap, scrollArea, displayTitle } from "./onboardingStyles";

// Écran 3 · Mode de partage (si couple), juste après le choix solo/couple.
// "shared" (dépenses partagées + suivi des dettes) vs "common" (compte commun,
// sans dette). Jauge 90 %.
export default function OnboardingShareMode({ language, onPick, onBack }) {
  const t = onboardingT(language);
  return (
    <div style={screenWrap}>
      <BackBar onBack={onBack} />
      <SetupGauge pct={90} label={t("gauge")} />
      <div style={scrollArea}>
        <h1 style={displayTitle}>{t("s5_t")}</h1>
        <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--ink-2)", margin: "0 0 22px" }}>
          {t("s5_sub")}
        </p>

        <ChoiceCard
          icon="ti-arrows-exchange"
          iconColor="--tang"
          title={t("s5_sh_t")}
          body={t("s5_sh_b")}
          selected
          badge={t("s5_default")}
          onClick={() => onPick("shared")}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--tang-light)",
              borderRadius: 10,
              padding: "9px 11px",
              marginTop: 12,
            }}
          >
            <i className="ti ti-scale" style={{ color: "var(--tang)", fontSize: 16 }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--tang)" }}>Alex → 12,50 €</span>
            <span style={{ fontSize: 11, color: "var(--ink-3)", marginLeft: "auto" }}>{t("s5_sh_tag")}</span>
          </div>
        </ChoiceCard>

        <ChoiceCard
          icon="ti-wallet"
          iconColor="--mint"
          title={t("s5_co_t")}
          body={t("s5_co_b")}
          badge={t("s5_co_tag")}
          onClick={() => onPick("common")}
        />
      </div>
    </div>
  );
}
