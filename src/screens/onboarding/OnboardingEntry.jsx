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
  kindColorOf,
} from "../../utils/onboardingDraft";
import { ALL_CATEGORIES, ALL_CURRENCIES, getCategoryName } from "../../data/categories";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { screenWrap, primaryBtn } from "./onboardingStyles";
import { StepDots } from "./onboardingUI";
import OnboardingHeader from "./OnboardingHeader";
import AmbientBackdrop from "../../components/AmbientBackdrop";
import { CHIPS, PLACEHOLDERS, KIND_COLOR } from "../../data/onboardingChips";

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

  const ph = placeholders[phIndex];
  // Propriétés communes aux deux champs (mobile / desktop) : même exemple, même
  // couleur, un seul endroit à faire évoluer.
  const phProps = {
    className: "pw-onb-input",
    placeholder: input ? "" : `${ph.em} ${ph.text}`,
  };
  const phVar = { "--pw-ph": `var(--${KIND_COLOR[ph.kind]})` };

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
          {...phProps}
          style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: big ? 18 : 14.5, fontWeight: 500, color: "var(--ink)", padding: big ? "16px 0" : "13px 0", minWidth: 0, ...phVar }}
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
        {chips.map((c) => {
          const hue = KIND_COLOR[c.kind];
          return (
            <button
              key={c.text}
              onClick={() => setInput(c.text)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: fz, fontWeight: 600, fontFamily: "inherit",
                // Pastille CLAIRE : fond carte + filet neutre, la couleur ne vit
                // que dans le texte (vert = revenu, corail = dépense, lavande =
                // investissement). Allège nettement la rangée par rapport au
                // fond teinté + liseré coloré précédent.
                background: "var(--bg-card)", color: `var(--${hue})`,
                border: "0.5px solid var(--rule)",
                borderRadius: 999, padding: big ? "6px 13px" : "4px 10px", cursor: "pointer",
              }}
            >
              <span aria-hidden="true">{c.em}</span>
              {c.text}
            </button>
          );
        })}
      </div>
    );
  }

  // Le montant de l'aperçu porte la couleur de la NATURE détectée : c'est la
  // réponse directe à la pastille de suggestion qu'on vient de cliquer, et une
  // teinte qui ne correspondrait pas démentirait la promesse faite juste avant.
  const previewKind = preview && kindColorOf(preview.type);
  const previewRow = preview && (
    <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 11, animation: "pw-rise .3s ease both" }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)", alignSelf: "center" }}>{t("s2_got")}</span>
      <Chip icon="ti-coin" bg={`var(${previewKind}-light)`} color={`var(${previewKind})`}>{formatMoney(preview.amount, preview.currency, language)}</Chip>
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
      {insight.tiles.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
          {insight.tiles.map((tile) => (
            <MiniTile key={tile.key} label={tile.label} value={tile.value} color={tile.color} compact={insight.tiles.length > 2} />
          ))}
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

          <div style={{ marginBottom: form.type === "expense" ? 18 : 4, position: "relative" }}>
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

          {/* Choix de catégorie réservé aux DÉPENSES : un revenu comme un
              placement n'a qu'une catégorie possible, et la grille ne propose que
              des catégories de dépense — l'ouvrir pour un investissement
              laisserait choisir « Alimentation » pour un ETF. */}
          {form.type === "expense" && (
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
        {/* En-tête marketing : présent uniquement sur la page d'accueil. */}
        <OnboardingHeader language={language} onSignIn={onSignIn} isDesktop={isDesktop} />
        <div style={{ position: "relative", zIndex: 1, flex: 1, overflowY: "auto", padding: "24px 24px 24px", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            {/* Pas de logo ici : le header marketing en porte déjà un juste
                au-dessus. Le hero commence directement au badge confidentialité. */}
            <div style={{ margin: isDesktop ? "0 0 52px" : "0 0 24px" }}>{privacyBadge}</div>
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
                    {...phProps}
                    style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 20, fontWeight: 500, color: "var(--ink)", padding: "18px 0", minWidth: 0, ...phVar }}
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
          {/* « Déjà un compte ? Se connecter » retiré : le header porte déjà
              « Connexion » (→ onSignIn), c'était un doublon. */}
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
        </div>
        {/* Pied FIGÉ, comme sur mobile. Le bouton vivait au bas de la zone
            défilante : il descendait avec la liste et sortait de l'écran dès
            quelques lignes ajoutées — c'est-à-dire précisément au moment où
            l'utilisateur a fini de saisir et cherche à continuer. */}
        <div style={{ flex: "none", padding: "12px 20px 16px", borderTop: "0.5px solid var(--rule)", background: "var(--bg)" }}>
          <div style={{ maxWidth: 360, margin: "0 auto" }}>{ctaBtn}</div>
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

// `compact` : trois tuiles au lieu de deux. À 390 px, ~116 px chacune — la
// valeur descend d'un point et les deux lignes se tronquent plutôt que de se
// replier, ce qui ferait grandir la carte d'une ligne à la moindre somme longue.
// Chasse fixe pour que les trois montants s'alignent verticalement.
function MiniTile({ label, value, color, compact = false }) {
  const clip = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
  return (
    <div style={{ flex: 1, minWidth: 0, background: "var(--bg-card)", borderRadius: 10, padding: "8px 10px" }}>
      <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--ink-3)", ...clip }}>{label}</div>
      <div style={{ fontSize: compact ? 14 : 15, fontWeight: 800, color, fontVariantNumeric: "tabular-nums", ...clip }}>{value}</div>
    </div>
  );
}
