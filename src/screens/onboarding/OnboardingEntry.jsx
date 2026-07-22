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
  currencySymbol,
} from "../../utils/onboardingDraft";
import { ALL_CATEGORIES, ALL_CURRENCIES, getCategoryName } from "../../data/categories";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { screenWrap, primaryBtn } from "./onboardingStyles";
import { StepDots } from "./onboardingUI";
import AmbientBackdrop from "../../components/AmbientBackdrop";

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
  const [form, setForm] = useState(null); // valeurs en cours d'édition d'une entrée
  const [collapsed, setCollapsed] = useState(false); // "retour" depuis l'étape 2 → accueil
  const [curOpen, setCurOpen] = useState(false); // sélecteur de devise ouvert dans la fiche d'édition
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
    setCollapsed(false);
  }
  function removeEntry(id) {
    const next = draft.filter((d) => d.id !== id);
    persist(next);
    if (next.length === 0) clearDraft();
  }
  // Édition complète d'une entrée (montant, description, catégorie).
  function openEdit(d) {
    setForm({
      description: d.description || "",
      amount: String(d.amount),
      currency: d.currency,
      categoryId: d.categoryId,
      type: d.type,
    });
    setEditId(d.id);
  }
  function closeEdit() {
    setEditId(null);
    setForm(null);
    setCurOpen(false);
  }
  function saveEdit() {
    const amt = parseFloat(String(form.amount).replace(",", "."));
    persist(
      draft.map((d) =>
        d.id === editId
          ? {
              ...d,
              description: form.description.trim() || null,
              amount: isNaN(amt) || amt <= 0 ? d.amount : amt,
              categoryId: form.categoryId,
              subcategory: form.categoryId !== d.categoryId ? null : d.subcategory,
            }
          : d
      )
    );
    closeEdit();
  }

  const insight = hasDraft ? deriveInsight(draft, language, t) : null;

  // ── Fragments réutilisés ────────────────────────────────────────────────
  function logo(center, big) {
    const large = big && isDesktop;
    const sz = large ? 42 : 28;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: large ? 13 : 9, justifyContent: center ? "center" : "flex-start" }}>
        <div style={{ width: sz, height: sz, borderRadius: sz * 0.28, background: "var(--tang)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: sz * 0.55 }}>P</div>
        <span style={{ fontWeight: 700, fontSize: large ? 24 : 15 }}>PairWise</span>
      </div>
    );
  }

  // Badge confidentialité — nettement plus grand sur l'accueil desktop.
  const badgeBig = isDesktop && !hasDraft;
  const privacyBadge = (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--sage-light)", color: "var(--sage)", borderRadius: 999, padding: badgeBig ? "9px 19px" : "5px 11px", fontSize: badgeBig ? 16 : 11, fontWeight: 600, lineHeight: 1.3 }}>
      <i className="ti ti-lock" style={{ fontSize: badgeBig ? 17 : 12 }} />
      <span>{t("s1_kicker")}</span>
    </div>
  );

  function inputField(big) {
    return (
      <div style={{ flex: 1, background: "var(--bg-card)", border: "1.5px solid var(--tang)", borderRadius: big ? 18 : 14, padding: big ? "0 18px" : "0 12px", display: "flex", alignItems: "center", gap: big ? 12 : 9, boxShadow: "0 6px 18px var(--tang-light)" }}>
        <i className="ti ti-sparkles" style={{ color: "var(--tang)", fontSize: big ? 22 : 18, flex: "none" }} />
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={input ? "" : placeholders[phIndex]}
          style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: big ? 18 : 14.5, fontWeight: 500, color: "var(--ink)", padding: big ? "16px 0" : "13px 0", minWidth: 0 }}
        />
      </div>
    );
  }

  // Champ + bouton flèche (étape 2). Plus grand sur desktop.
  function addRow(big) {
    const sz = big ? 56 : 46;
    return (
      <div style={{ display: "flex", gap: big ? 10 : 8, alignItems: "center" }}>
        {inputField(big)}
        <button onClick={submit} aria-label={t("s2_add")} style={{ border: "none", background: "var(--tang)", color: "#fff", borderRadius: big ? 16 : 13, width: sz, height: sz, flex: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow)" }}>
          <i className="ti ti-arrow-up" style={{ fontSize: big ? 24 : 20 }} />
        </button>
      </div>
    );
  }

  function chipsRow(big, center) {
    const fz = big ? 14 : 11.5;
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: big ? 8 : 6, marginTop: big ? 16 : 11, justifyContent: center ? "center" : "flex-start" }}>
        <span style={{ fontSize: fz, color: "var(--ink-3)", alignSelf: "center" }}>{t("s1_try")}</span>
        {chips.map((c) => (
          <button key={c} onClick={() => setInput(c)} style={{ fontSize: fz, color: "var(--ink-2)", background: "var(--bg-card)", border: "0.5px solid var(--rule)", borderRadius: 999, padding: big ? "6px 13px" : "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>
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
    <div style={{ background: "linear-gradient(135deg, var(--sage-light), var(--mint-light))", borderRadius: isDesktop ? 20 : 16, padding: isDesktop ? "20px 22px" : "15px 16px", animation: "pw-rise .4s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: isDesktop ? 13 : 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--sage)", marginBottom: 8 }}>
        <i className="ti ti-sparkles" style={{ fontSize: isDesktop ? 15 : 13 }} />
        {t("s2_insight")}
      </div>
      <div style={{ fontSize: isDesktop ? 19 : 15, fontWeight: 600, lineHeight: 1.4, color: "var(--ink)" }}>{insight.insight}</div>
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
      <div style={{ fontSize: isDesktop ? 13 : 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--ink-3)", margin: "0 0 12px" }}>{t("s2_break")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: isDesktop ? 13 : 10 }}>
        {insight.breakdown.map((c) => (
          <div key={c.categoryId} style={{ display: "flex", alignItems: "center", gap: isDesktop ? 12 : 10 }}>
            <div style={{ width: isDesktop ? 36 : 30, height: isDesktop ? 36 : 30, borderRadius: 10, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: `var(${c.color}-light)`, color: `var(${c.color})` }}>
              <i className={`ti ${c.icon}`} style={{ fontSize: isDesktop ? 19 : 16 }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: isDesktop ? 15 : 13, fontWeight: 600, marginBottom: 5 }}>
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
    const big = isDesktop;
    const av = big ? 38 : 32;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: big ? 10 : 8 }}>
        {draft.map((d) => {
          const v = draftEntryView(d, language, t);
          // Toute la ligne est cliquable pour éditer ; la corbeille reste à part.
          return (
            <div
              key={d.id}
              onClick={() => openEdit(d)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openEdit(d)}
              style={{ display: "flex", alignItems: "center", gap: big ? 12 : 10, background: "var(--bg-card)", border: "0.5px solid var(--rule)", borderRadius: 12, padding: big ? "12px 14px" : "9px 11px", animation: "pw-pop .5s ease both", cursor: "pointer" }}
            >
              <div style={{ position: "relative", width: av, height: av, borderRadius: 10, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: `var(${v.color}-light)`, color: `var(${v.color})` }}>
                <i className={`ti ${v.icon}`} style={{ fontSize: big ? 19 : 16 }} />
                <i className="ti ti-pencil" style={{ position: "absolute", right: -4, bottom: -4, fontSize: 11, background: "var(--bg-card)", borderRadius: 99, padding: 1, color: "var(--ink-3)" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: big ? 15.5 : 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.catName}</div>
                <div style={{ fontSize: big ? 13 : 11.5, color: "var(--ink-3)" }}>{v.dateLabel}</div>
              </div>
              <div style={{ fontSize: big ? 16 : 14, fontWeight: 700, color: v.amountColor }}>{v.amountDisp}</div>
              <button
                onClick={(e) => { e.stopPropagation(); removeEntry(d.id); }}
                aria-label="Supprimer"
                style={{ background: "none", border: "none", display: "flex", color: "var(--ink-3)", cursor: "pointer", padding: 4, flex: "none" }}
              >
                <i className="ti ti-trash" style={{ fontSize: big ? 18 : 16 }} />
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

  const fieldLabel = { fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--ink-3)", marginBottom: 7 };
  const fieldBox = { width: "100%", background: "var(--bg-card)", border: "0.5px solid var(--rule)", borderRadius: 12, padding: "12px 13px", fontFamily: "inherit", fontSize: 15, color: "var(--ink)", outline: "none", boxSizing: "border-box" };

  const editSheet = editId && form && (
    <div
      onClick={closeEdit}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: isDesktop ? 24 : 10 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 430,
          height: isDesktop ? "auto" : "100%",
          background: "var(--bg)",
          borderRadius: "var(--radius-xl)",
          display: "flex",
          flexDirection: "column",
          maxHeight: isDesktop ? "86vh" : "100%",
          overflow: "hidden",
          boxShadow: isDesktop ? "0 24px 60px rgba(0,0,0,.28)" : "0 8px 32px rgba(0,0,0,.22)",
        }}
      >
        {/* En-tête sticky : retour à gauche + titre centré */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 18px", borderBottom: "0.5px solid var(--rule)", flex: "none" }}>
          <button onClick={closeEdit} aria-label={t("e_cancel")} style={{ position: "absolute", left: 14, background: "none", border: "none", display: "flex", color: "var(--ink-3)", cursor: "pointer", padding: 2 }}>
            <i className="ti ti-arrow-left" style={{ fontSize: 22 }} />
          </button>
          <div style={{ fontSize: 16, fontWeight: 700, textAlign: "center" }}>{t("e_title")}</div>
        </div>

        {/* Corps défilant */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
          <div style={{ marginBottom: 14 }}>
            <div style={fieldLabel}>{t("e_desc")}</div>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t("e_desc_ph")}
              style={fieldBox}
            />
          </div>

          <div style={{ marginBottom: form.type === "income" ? 4 : 18, position: "relative" }}>
            <div style={fieldLabel}>{t("e_amount")}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                inputMode="decimal"
                style={{ ...fieldBox, flex: 1 }}
              />
              <button
                type="button"
                onClick={() => setCurOpen((o) => !o)}
                style={{ display: "flex", alignItems: "center", gap: 4, flex: "none", background: "var(--bg-card)", border: "0.5px solid var(--rule)", borderRadius: 12, padding: "12px 12px", fontFamily: "inherit", fontSize: 14, fontWeight: 700, color: "var(--ink-2)", cursor: "pointer" }}
              >
                {currencySymbol(form.currency)} {form.currency}
                <i className={`ti ti-chevron-${curOpen ? "up" : "down"}`} style={{ fontSize: 14 }} />
              </button>
            </div>

            {curOpen && (
              <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 6, zIndex: 5, width: 190, maxHeight: 220, overflowY: "auto", background: "var(--bg-card)", border: "0.5px solid var(--rule)", borderRadius: 12, boxShadow: "0 12px 28px rgba(0,0,0,.16)", padding: 6 }}>
                {ALL_CURRENCIES.map((c) => {
                  const sel = c.code === form.currency;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => { setForm({ ...form, currency: c.code }); setCurOpen(false); }}
                      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: sel ? "var(--sky-light)" : "transparent", border: "none", borderRadius: 8, padding: "8px 9px", fontFamily: "inherit", fontSize: 13, color: sel ? "var(--sky)" : "var(--ink)", cursor: "pointer", textAlign: "left" }}
                    >
                      <span>{c.symbol} {c.code}</span>
                      {sel && <i className="ti ti-check" style={{ fontSize: 13 }} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {form.type !== "income" && (
            <>
              <div style={fieldLabel}>{t("e_cat")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, minWidth: 0 }}>
                {EXPENSE_CATS.map((c) => {
                  const sel = form.categoryId === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setForm({ ...form, categoryId: c.id })}
                      style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, background: "var(--bg-card)", border: `1.5px solid ${sel ? `var(--${c.color})` : "var(--rule)"}`, borderRadius: 12, padding: "9px 9px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                    >
                      <div style={{ width: 24, height: 24, borderRadius: 7, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: `var(--${c.color}-light)`, color: `var(--${c.color})` }}>
                        <i className={`ti ${c.icon}`} style={{ fontSize: 13 }} />
                      </div>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getCategoryName(c, language)}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Pied sticky : valider */}
        <div style={{ flex: "none", padding: "12px 18px", borderTop: "0.5px solid var(--rule)" }}>
          <button onClick={saveEdit} style={primaryBtn}>
            <i className="ti ti-check" style={{ fontSize: 17 }} />
            {t("e_save")}
          </button>
        </div>
      </div>
    </div>
  );

  // ── ÉTAT ACCUEIL (aucune entrée, ou "retour" depuis l'étape 2) ───────────
  if (!hasDraft || collapsed) {
    return (
      <div style={{ ...screenWrap, maxWidth: isDesktop ? 760 : 430 }}>
        {/* Ambiance décorative en arrière-plan (derrière tout le contenu). */}
        <AmbientBackdrop />
        <div style={{ position: "relative", zIndex: 1, flex: 1, overflowY: "auto", padding: "32px 24px 24px", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            {logo(true, true)}
            <div style={{ margin: isDesktop ? "30px 0 52px" : "24px 0" }}>{privacyBadge}</div>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: isDesktop ? 52 : 29, lineHeight: 1.12, letterSpacing: "-0.02em", color: "var(--ink)", margin: "0 0 20px", maxWidth: isDesktop ? 660 : 340 }}>
              {t("s1_title")}
            </h1>
            <p style={{ fontSize: isDesktop ? 21 : 15, lineHeight: 1.5, color: "var(--ink-3)", margin: isDesktop ? "0 0 38px" : "0 0 30px", maxWidth: isDesktop ? 560 : 320 }}>
              {t("s1_sub")}
            </p>

            <div style={{ width: "100%", maxWidth: isDesktop ? 660 : 540 }}>
              {isDesktop ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--bg-card)", border: "1.5px solid var(--tang)", borderRadius: 22, padding: "10px 10px 10px 22px", boxShadow: "0 12px 32px var(--tang-light)" }}>
                  <i className="ti ti-sparkles" style={{ color: "var(--tang)", fontSize: 24, flex: "none" }} />
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                    placeholder={input ? "" : placeholders[phIndex]}
                    style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 20, fontWeight: 500, color: "var(--ink)", padding: "18px 0", minWidth: 0 }}
                  />
                  <button onClick={submit} style={{ ...primaryBtn, width: "auto", padding: "0 26px", height: 58, flex: "none", fontSize: 18, borderRadius: 16 }}>
                    {t("s1_cta")}
                    <i className="ti ti-arrow-right" style={{ fontSize: 19 }} />
                  </button>
                </div>
              ) : (
                <>
                  {inputField()}
                  <button onClick={submit} style={{ ...primaryBtn, marginTop: 12 }}>
                    {t("s1_cta")}
                    <i className="ti ti-arrow-right" style={{ fontSize: 17 }} />
                  </button>
                </>
              )}
            </div>
            {previewRow}
            {chipsRow(isDesktop, true)}
            {collapsed && hasDraft && (
              <button
                onClick={() => setCollapsed(false)}
                style={{ marginTop: 24, background: "none", border: "none", color: "var(--tang)", fontWeight: 700, fontSize: isDesktop ? 17 : 14, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {language === "en" ? "Resume" : "Reprendre"}
                <i className="ti ti-arrow-right" style={{ fontSize: 16 }} />
              </button>
            )}
          </div>
          <div style={{ fontSize: isDesktop ? 18 : 13, color: "var(--ink-3)", textAlign: "center", paddingTop: 28 }}>
            {t("s1_signin")}{" "}
            <button onClick={onSignIn} style={{ background: "none", border: "none", fontWeight: 700, color: "var(--sky)", cursor: "pointer", fontSize: isDesktop ? 18 : 13, fontFamily: "inherit" }}>
              {t("s1_signinCta")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── ÉTAT "AJOUTE DES ÉLÉMENTS" (étape 2/3) ──────────────────────────────
  // Logo centré tout en haut ; le badge confidentialité ne s'affiche que sur
  // l'accueil (pas répété ici). Flèche retour liée à "Étape 2/3".
  const topBar = (
    <div style={{ flex: "none" }}>
      <div style={{ padding: "16px 20px 0", display: "flex", justifyContent: "center" }}>
        {logo(true)}
      </div>
      <StepDots current={2} total={3} label={t("step")} onBack={() => setCollapsed(true)} />
    </div>
  );

  // Bloc de saisie (label + champ + chips) — colonne gauche desktop / en-tête mobile.
  const addZone = (
    <div>
      <div style={{ fontSize: isDesktop ? 16 : 13, fontWeight: 700, color: "var(--ink-2)", marginBottom: isDesktop ? 12 : 9 }}>{t("s2_hero")}</div>
      {addRow(isDesktop)}
      {previewRow}
      {chipsRow(isDesktop, false)}
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
            {/* marginTop = hauteur du label "Ajoute…" pour aligner l'insight sur le champ de saisie */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 32 }}>
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
