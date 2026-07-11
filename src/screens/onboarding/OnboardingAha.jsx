import { useState } from "react";
import { onboardingT } from "../../data/onboardingCopy";
import {
  loadDraft,
  saveDraft,
  clearDraft,
  parseDraftEntry,
  draftEntryView,
  deriveInsight,
  guessDefaultCurrency,
  formatMoney,
} from "../../utils/onboardingDraft";
import { screenWrap, primaryBtn, ghostBtn } from "./onboardingStyles";

const CHIPS = {
  fr: ["15€ déjeuner hier", "2400€ salaire", "un café 3€"],
  en: ["$15 lunch yesterday", "$2400 salary", "a coffee $3"],
};

// Écran 2 · Saisie langage naturel + "aha". L'utilisateur tape 2–3 lignes ;
// chacune est catégorisée automatiquement ; un insight + une répartition
// apparaissent → moment "aha". Le brouillon vit en localStorage.
export default function OnboardingAha({ language, onCreateAccount }) {
  const t = onboardingT(language);
  const defCur = guessDefaultCurrency();
  const [draft, setDraft] = useState(() => loadDraft());
  const [input, setInput] = useState("");

  const preview = input.trim() ? parseDraftEntry(input, language, defCur) : null;
  const hasDraft = draft.length > 0;

  function submit() {
    const entry = parseDraftEntry(input, language, defCur);
    if (!entry) return;
    const next = [entry, ...draft];
    setDraft(next);
    saveDraft(next);
    setInput("");
  }

  function reset() {
    setDraft([]);
    clearDraft();
    setInput("");
  }

  const insight = hasDraft ? deriveInsight(draft, language, t) : null;

  return (
    <div style={screenWrap}>
      {/* Zone de saisie (collée en haut) */}
      <div style={{ flex: "none", padding: "18px 22px 14px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)", marginBottom: 9 }}>
          {t("s2_hero")}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div
            style={{
              flex: 1,
              background: "var(--bg-card)",
              border: "1.5px solid var(--tang)",
              borderRadius: 14,
              padding: "0 12px",
              display: "flex",
              alignItems: "center",
              gap: 9,
              boxShadow: "0 6px 18px var(--tang-light)",
            }}
          >
            <i className="ti ti-sparkles" style={{ color: "var(--tang)", fontSize: 18 }} />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={CHIPS[language === "en" ? "en" : "fr"][0]}
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                background: "transparent",
                fontFamily: "inherit",
                fontSize: 14.5,
                fontWeight: 500,
                color: "var(--ink)",
                padding: "13px 0",
                minWidth: 0,
              }}
            />
          </div>
          <button
            onClick={submit}
            aria-label={t("s2_add")}
            style={{
              border: "none",
              background: "var(--tang)",
              color: "#fff",
              borderRadius: 13,
              width: 46,
              height: 46,
              flex: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "var(--shadow)",
            }}
          >
            <i className="ti ti-arrow-up" style={{ fontSize: 20 }} />
          </button>
        </div>

        {preview && (
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 11, animation: "pw-rise .3s ease both" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)", alignSelf: "center" }}>
              {t("s2_got")}
            </span>
            <Chip icon="ti-coin" bg="var(--tang-light)" color="var(--tang)">
              {formatMoney(preview.amount, preview.currency, language)}
            </Chip>
            <PreviewCatChip entry={preview} language={language} t={t} />
          </div>
        )}
      </div>

      {/* Zone défilante : état vide OU insight + répartition + lignes */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 22px 22px", borderTop: "0.5px solid var(--rule)" }}>
        {!hasDraft ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              textAlign: "center",
              color: "var(--ink-3)",
              gap: 12,
              padding: "40px 20px",
            }}
          >
            <i className="ti ti-arrow-up" style={{ fontSize: 28, opacity: 0.5 }} />
            <span style={{ fontSize: 13.5, lineHeight: 1.5, maxWidth: 200 }}>{t("s2_empty")}</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", maxWidth: 250 }}>
              {CHIPS[language === "en" ? "en" : "fr"].map((c) => (
                <button
                  key={c}
                  onClick={() => setInput(c)}
                  style={{
                    fontSize: 11.5,
                    color: "var(--ink-2)",
                    background: "var(--bg-card)",
                    border: "0.5px solid var(--rule)",
                    borderRadius: 999,
                    padding: "4px 10px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ paddingTop: 14 }}>
            {/* Carte insight */}
            <div
              style={{
                background: "linear-gradient(135deg, var(--sage-light), var(--mint-light))",
                borderRadius: 16,
                padding: "15px 16px",
                marginBottom: 16,
                animation: "pw-rise .4s ease both",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--sage)",
                  marginBottom: 7,
                }}
              >
                <i className="ti ti-sparkles" style={{ fontSize: 13 }} />
                {t("s2_insight")}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.4, color: "var(--ink)" }}>
                {insight.insight}
              </div>
              {insight.hasIncome && (
                <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
                  <MiniTile label={t("revLabel")} value={insight.incomeDisp} color="var(--sage)" />
                  <MiniTile label={t("expLabel")} value={insight.expenseDisp} color="var(--tang)" />
                </div>
              )}
            </div>

            {/* Répartition */}
            {insight.breakdown.length > 0 && (
              <>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: "var(--ink-3)",
                    marginBottom: 10,
                  }}
                >
                  {t("s2_break")}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
                  {insight.breakdown.map((c) => (
                    <div key={c.categoryId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 9,
                          flex: "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: `var(${c.color}-light)`,
                          color: `var(${c.color})`,
                        }}
                      >
                        <i className={`ti ${c.icon}`} style={{ fontSize: 16 }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 8,
                            fontSize: 13,
                            fontWeight: 600,
                            marginBottom: 4,
                          }}
                        >
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                          <span style={{ whiteSpace: "nowrap", flex: "none" }}>{c.amountFmt}</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 99, background: "var(--rule)", overflow: "hidden" }}>
                          <div
                            style={{
                              height: "100%",
                              borderRadius: 99,
                              background: `var(${c.color})`,
                              width: `${c.pct}%`,
                              transition: "width .5s ease",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Lignes saisies */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {draft.map((d) => {
                const v = draftEntryView(d, language, t);
                return (
                  <div
                    key={d.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      background: "var(--bg-card)",
                      border: "0.5px solid var(--rule)",
                      borderRadius: 12,
                      padding: "9px 11px",
                      animation: "pw-pop .5s ease both",
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 9,
                        flex: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: `var(${v.color}-light)`,
                        color: `var(${v.color})`,
                      }}
                    >
                      <i className={`ti ${v.icon}`} style={{ fontSize: 16 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {v.catName}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{v.dateLabel}</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: v.amountColor }}>{v.amountDisp}</div>
                  </div>
                );
              })}
            </div>

            <button onClick={() => onCreateAccount(draft)} style={{ ...primaryBtn, marginTop: 16 }}>
              {t("s2_next")}
              <i className="ti ti-arrow-right" style={{ fontSize: 16 }} />
            </button>
            <button onClick={reset} style={{ ...ghostBtn, marginTop: 10 }}>
              <i className="ti ti-trash" style={{ fontSize: 14 }} />
              {t("s2_reset")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ icon, bg, color, children }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 12,
        fontWeight: 700,
        background: bg,
        color,
        borderRadius: 8,
        padding: "5px 9px",
      }}
    >
      <i className={`ti ${icon}`} style={{ fontSize: 13 }} />
      {children}
    </span>
  );
}

function PreviewCatChip({ entry, language, t }) {
  const v = draftEntryView(entry, language, t);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 12,
        fontWeight: 600,
        borderRadius: 8,
        padding: "5px 9px",
        background: `var(${v.color}-light)`,
        color: `var(${v.color})`,
      }}
    >
      <i className={`ti ${v.icon}`} style={{ fontSize: 13 }} />
      {v.catName}
    </span>
  );
}

function MiniTile({ label, value, color }) {
  return (
    <div style={{ flex: 1, background: "var(--bg-card)", borderRadius: 10, padding: "8px 10px" }}>
      <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--ink-3)" }}>
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}
