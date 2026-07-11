import { useState, useEffect, useRef } from "react";
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
import { ALL_CATEGORIES, getCategoryName } from "../../data/categories";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { screenWrap, primaryBtn } from "./onboardingStyles";
import { StepDots } from "./onboardingUI";

const CHIPS = {
  fr: ["15€ déjeuner hier", "un café 3€", "loyer 800€", "téléphone 20€", "2400€ salaire"],
  en: ["$15 lunch yesterday", "a coffee $3", "rent $800", "phone $20", "$2400 salary"],
};
// Exemples qui défilent dans le champ tant que l'utilisateur n'a rien tapé.
const PLACEHOLDERS = {
  fr: ["15€ déjeuner hier", "42,50 courses", "un café 3€", "80€ essence samedi", "2400€ salaire"],
  en: ["$15 lunch yesterday", "42.50 groceries", "a coffee $3", "$80 gas saturday", "$2400 salary"],
};

const EXPENSE_CATS = ALL_CATEGORIES.filter(
  (c) => !["income", "investment", "savings"].includes(c.id)
);

// Écran 1 unifié · Accueil ↔ "ajoute des éléments". Une seule page qui se
// transforme : à vide, c'est l'accueil (hero centré + champ à exemples
// défilants) ; dès la 1ʳᵉ ligne, elle devient l'étape 2/3. Langue détectée
// depuis le navigateur (pas de sélecteur). Desktop en 2 colonnes.
export default function OnboardingEntry({ language, onSignIn, onNext }) {
  const t = onboardingT(language);
  const defCur = guessDefaultCurrency();
  const isDesktop = useMediaQuery("(min-width: 760px)");
  const lg = language === "en" ? "en" : "fr";

  const [draft, setDraft] = useState(() => loadDraft());
  const [input, setInput] = useState("");
  const [editId, setEditId] = useState(null);
  const [phIndex, setPhIndex] = useState(0);
  const inputRef = useRef(null);

  const chips = CHIPS[lg];
  const placeholders = PLACEHOLDERS[lg];

  useEffect(() => {
    if (input) return;
    const iv = setInterval(() => setPhIndex((n) => (n + 1) % placeholders.length), 2600);
    return () => clearInterval(iv);
  }, [input, placeholders.length]);

  const preview = input.trim() ? parseDraftEntry(input, language, defCur) : null;
  const hasDraft = draft.length > 0;

  function persist(next) {
    setDraft(next);
    saveDraft(next);
  }
  function submit() {
    const entry = parseDraftEntry(input, language, defCur);
    if (!entry) {
      inputRef.current?.focus();
      return;
    }
    persist([entry, ...draft]);
    setInput("");
  }
  function removeEntry(id) {
    const next = draft.filter((d) => d.id !== id);
    persist(next);
    if (next.length === 0) clearDraft();
  }
  function setCategory(id, categoryId) {
    persist(draft.map((d) => (d.id === id ? { ...d, categoryId, subcategory: null } : d)));
    setEditId(null);
  }

  const insight = hasDraft ? deriveInsight(draft, language, t) : null;

  // ── Fragments réutilisés ────────────────────────────────────────────────
  function logo(center) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 9, justifyContent: center ? "center" : "flex-start" }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--tang)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 15 }}>P</div>
        <span style={{ fontWeight: 700, fontSize: 15 }}>PairWise</span>
      </div>
    );
  }

  const privacyBadge = (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "var(--sage-light)", color: "var(--sage)", borderRadius: 999, padding: "5px 11px", fontSize: 11, fontWeight: 600, lineHeight: 1.3 }}>
      <i className="ti ti-lock" style={{ fontSize: 12 }} />
      <span>{t("s1_kicker")}</span>
    </div>
  );

  function inputField() {
    return (
      <div style={{ flex: 1, background: "var(--bg-card)", border: "1.5px solid var(--tang)", borderRadius: 14, padding: "0 12px", display: "flex", alignItems: "center", gap: 9, boxShadow: "0 6px 18px var(--tang-light)" }}>
        <i className="ti ti-sparkles" style={{ color: "var(--tang)", fontSize: 18 }} />
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={input ? "" : placeholders[phIndex]}
          style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 14.5, fontWeight: 500, color: "var(--ink)", padding: "13px 0", minWidth: 0 }}
        />
      </div>
    );
  }

  // Champ + bouton flèche (étape 2).
  function addRow() {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {inputField()}
        <button onClick={submit} aria-label={t("s2_add")} style={{ border: "none", background: "var(--tang)", color: "#fff", borderRadius: 13, width: 46, height: 46, flex: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow)" }}>
          <i className="ti ti-arrow-up" style={{ fontSize: 20 }} />
        </button>
      </div>
    );
  }

  function chipsRow(center) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 11, justifyContent: center ? "center" : "flex-start" }}>
        <span style={{ fontSize: 11.5, color: "var(--ink-3)", alignSelf: "center" }}>{t("s1_try")}</span>
        {chips.map((c) => (
          <button key={c} onClick={() => setInput(c)} style={{ fontSize: 11.5, color: "var(--ink-2)", background: "var(--bg-card)", border: "0.5px solid var(--rule)", borderRadius: 999, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>
            {c}
          </button>
        ))}
      </div>
    );
  }

  const previewRow = preview && (
    <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 11, animation: "pw-rise .3s ease both" }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)", alignSelf: "center" }}>{t("s2_got")}</span>
      <Chip icon="ti-coin" bg="var(--tang-light)" color="var(--tang)">{formatMoney(preview.amount, preview.currency, language)}</Chip>
      <PreviewCatChip entry={preview} language={language} t={t} />
    </div>
  );

  const insightCard = insight && (
    <div style={{ background: "linear-gradient(135deg, var(--sage-light), var(--mint-light))", borderRadius: 16, padding: "15px 16px", animation: "pw-rise .4s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--sage)", marginBottom: 7 }}>
        <i className="ti ti-sparkles" style={{ fontSize: 13 }} />
        {t("s2_insight")}
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.4, color: "var(--ink)" }}>{insight.insight}</div>
      {insight.hasIncome && (
        <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
          <MiniTile label={t("revLabel")} value={insight.incomeDisp} color="var(--sage)" />
          <MiniTile label={t("expLabel")} value={insight.expenseDisp} color="var(--tang)" />
        </div>
      )}
    </div>
  );

  const breakdownBlock = insight && insight.breakdown.length > 0 && (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--ink-3)", margin: "0 0 10px" }}>{t("s2_break")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {insight.breakdown.map((c) => (
          <div key={c.categoryId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: `var(${c.color}-light)`, color: `var(${c.color})` }}>
              <i className={`ti ${c.icon}`} style={{ fontSize: 16 }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                <span style={{ whiteSpace: "nowrap", flex: "none" }}>{c.amountFmt}</span>
              </div>
              <div style={{ height: 6, borderRadius: 99, background: "var(--rule)", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 99, background: `var(${c.color})`, width: `${c.pct}%`, transition: "width .5s ease" }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  function listBlock() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {draft.map((d) => {
          const v = draftEntryView(d, language, t);
          return (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--bg-card)", border: "0.5px solid var(--rule)", borderRadius: 12, padding: "9px 11px", animation: "pw-pop .5s ease both" }}>
              <button
                onClick={() => d.type !== "income" && setEditId(editId === d.id ? null : d.id)}
                aria-label="Modifier la catégorie"
                style={{ position: "relative", width: 32, height: 32, borderRadius: 9, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: `var(${v.color}-light)`, color: `var(${v.color})`, border: "none", cursor: d.type === "income" ? "default" : "pointer" }}
              >
                <i className={`ti ${v.icon}`} style={{ fontSize: 16 }} />
                {d.type !== "income" && (
                  <i className="ti ti-pencil" style={{ position: "absolute", right: -4, bottom: -4, fontSize: 11, background: "var(--bg-card)", borderRadius: 99, padding: 1, color: "var(--ink-3)" }} />
                )}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.catName}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{v.dateLabel}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: v.amountColor }}>{v.amountDisp}</div>
              <button
                onClick={() => removeEntry(d.id)}
                aria-label="Supprimer"
                style={{ background: "none", border: "none", display: "flex", color: "var(--ink-3)", cursor: "pointer", padding: 4, flex: "none" }}
              >
                <i className="ti ti-trash" style={{ fontSize: 16 }} />
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  const ctaBtn = (
    <button onClick={onNext} style={primaryBtn}>
      {t("s2_next")}
      <i className="ti ti-arrow-right" style={{ fontSize: 16 }} />
    </button>
  );

  const editSheet = editId && (
    <div onClick={() => setEditId(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 430, background: "var(--bg)", borderTopLeftRadius: "var(--radius-xl)", borderTopRightRadius: "var(--radius-xl)", padding: "18px 18px 26px", maxHeight: "70vh", overflowY: "auto" }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>{language === "en" ? "Choose a category" : "Choisir une catégorie"}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {EXPENSE_CATS.map((c) => (
            <button key={c.id} onClick={() => setCategory(editId, c.id)} style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--bg-card)", border: "0.5px solid var(--rule)", borderRadius: 12, padding: "10px 11px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: `var(--${c.color}-light)`, color: `var(--${c.color})` }}>
                <i className={`ti ${c.icon}`} style={{ fontSize: 15 }} />
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getCategoryName(c, language)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ── ÉTAT ACCUEIL (aucune entrée) — centré, sans sélecteur de langue ──────
  if (!hasDraft) {
    return (
      <div style={{ ...screenWrap, maxWidth: 430 }}>
        <div style={{ flex: 1, overflowY: "auto", padding: "40px 22px 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          {logo(true)}
          <div style={{ margin: "22px 0 22px" }}>{privacyBadge}</div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 27, lineHeight: 1.2, letterSpacing: "-0.01em", color: "var(--ink)", margin: "0 0 12px", maxWidth: 340 }}>
            {t("s1_title")}
          </h1>
          <p style={{ fontSize: 14.5, lineHeight: 1.5, color: "var(--ink-3)", margin: "0 0 26px", maxWidth: 320 }}>
            {t("s1_sub")}
          </p>
          <div style={{ width: "100%", display: "flex", gap: 8, alignItems: "center" }}>
            {inputField()}
            {isDesktop && (
              <button onClick={submit} style={{ ...primaryBtn, width: "auto", padding: "0 18px", height: 48, flex: "none" }}>
                {t("s1_cta")}
                <i className="ti ti-arrow-right" style={{ fontSize: 16 }} />
              </button>
            )}
          </div>
          {previewRow}
          {!isDesktop && (
            <button onClick={submit} style={{ ...primaryBtn, marginTop: 12 }}>
              {t("s1_cta")}
              <i className="ti ti-arrow-right" style={{ fontSize: 17 }} />
            </button>
          )}
          {chipsRow(true)}
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 13, color: "var(--ink-3)", paddingTop: 24 }}>
            {t("s1_signin")}{" "}
            <button onClick={onSignIn} style={{ background: "none", border: "none", fontWeight: 700, color: "var(--sky)", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
              {t("s1_signinCta")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── ÉTAT "AJOUTE DES ÉLÉMENTS" (étape 2/3) ──────────────────────────────
  const topBar = (
    <div style={{ flex: "none" }}>
      <div style={{ padding: "16px 20px 0" }}>
        {logo(false)}
        <div style={{ marginTop: 12 }}>{privacyBadge}</div>
      </div>
      <StepDots current={2} total={3} label={t("step")} />
    </div>
  );

  // Bloc de saisie (label + champ + chips) — colonne gauche desktop / en-tête mobile.
  const addZone = (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)", marginBottom: 9 }}>{t("s2_hero")}</div>
      {addRow()}
      {previewRow}
      {chipsRow(false)}
    </div>
  );

  if (isDesktop) {
    return (
      <div style={{ ...screenWrap, maxWidth: 760, height: "100dvh", overflow: "hidden" }}>
        {topBar}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {addZone}
              {listBlock()}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {insightCard}
              {breakdownBlock}
            </div>
          </div>
          <div style={{ maxWidth: 360, margin: "28px auto 0" }}>{ctaBtn}</div>
        </div>
        {editSheet}
      </div>
    );
  }

  // Mobile : en-tête (stepper + saisie) → contenu défilant → footer CTA collé.
  return (
    <div style={{ ...screenWrap, maxWidth: 430, height: "100dvh", overflow: "hidden" }}>
      {topBar}
      <div style={{ padding: "10px 20px 0", flex: "none" }}>{addZone}</div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 18px", borderTop: "0.5px solid var(--rule)", marginTop: 14, display: "flex", flexDirection: "column", gap: 16 }}>
        {insightCard}
        {breakdownBlock}
        {listBlock()}
      </div>
      <div style={{ flex: "none", padding: "12px 20px 16px", borderTop: "0.5px solid var(--rule)", background: "var(--bg)" }}>
        {ctaBtn}
      </div>
      {editSheet}
    </div>
  );
}

function Chip({ icon, bg, color, children }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, background: bg, color, borderRadius: 8, padding: "5px 9px" }}>
      <i className={`ti ${icon}`} style={{ fontSize: 13 }} />
      {children}
    </span>
  );
}

function PreviewCatChip({ entry, language, t }) {
  const v = draftEntryView(entry, language, t);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, borderRadius: 8, padding: "5px 9px", background: `var(${v.color}-light)`, color: `var(${v.color})` }}>
      <i className={`ti ${v.icon}`} style={{ fontSize: 13 }} />
      {v.catName}
    </span>
  );
}

function MiniTile({ label, value, color }) {
  return (
    <div style={{ flex: 1, background: "var(--bg-card)", borderRadius: 10, padding: "8px 10px" }}>
      <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--ink-3)" }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}
