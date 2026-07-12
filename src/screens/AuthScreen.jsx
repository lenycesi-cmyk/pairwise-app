import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import Logo from "../components/Logo";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { onboardingT, detectOnboardingLanguage } from "../data/onboardingCopy";
import { draftEntryView, deriveInsight } from "../utils/onboardingDraft";

// Combien de lignes de brouillon on affiche avant de résumer le reste en
// "+N autres" — garde la carte compacte sur mobile (pas de scroll voulu).
const MAX_DRAFT_ROWS = 4;

export default function AuthScreen({ defaultMode = "login", draft = [], language, onBack = null }) {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 760px)");
  const lang = language || detectOnboardingLanguage();
  const t = onboardingT(lang);
  const draftCount = draft.length;
  const showDraft = draftCount > 0 && mode === "signup";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signup(email, password, name);
      }
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setBusy(false);
    }
  }

  // Carte "à rattacher à ton compte" : liste condensée du brouillon + note
  // verte de rétention. Affichée quand il y a des entrées à sauvegarder.
  const draftPanel = showDraft && (() => {
    const insight = deriveInsight(draft, lang, t);
    const rows = draft.slice(0, MAX_DRAFT_ROWS).map((d) => draftEntryView(d, lang, t));
    const rest = draft.length - rows.length;
    return (
      <div style={{ width: "100%" }}>
        <div style={{ background: "var(--bg-card)", border: "0.5px solid var(--rule)", borderRadius: "var(--radius-lg)", padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--ink-3)" }}>
              {t("s6_draft")}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--amber-light)", color: "var(--amber)", borderRadius: 999, padding: "3px 9px", fontSize: 10.5, fontWeight: 700, flex: "none" }}>
              <i className="ti ti-cloud-off" style={{ fontSize: 11 }} aria-hidden="true" />
              {t("s6_notsaved")}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                <div style={{ width: 26, height: 26, borderRadius: 8, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: `var(${r.color}-light)`, color: `var(${r.color})` }}>
                  <i className={`ti ${r.icon}`} style={{ fontSize: 13 }} aria-hidden="true" />
                </div>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.catName}</span>
                <span style={{ flex: "none", fontSize: 13, fontWeight: 700, color: r.amountColor }}>{r.amountDisp}</span>
              </div>
            ))}
            {rest > 0 && (
              <div style={{ fontSize: 12, color: "var(--ink-3)", paddingLeft: 35 }}>+{rest} {lang === "en" ? "more" : "autres"}</div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, borderTop: "0.5px solid var(--rule)", marginTop: 10, paddingTop: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{lang === "en" ? "Total" : "Total"}</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)" }}>{insight.expenseDisp}</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "var(--sage-light)", color: "var(--sage)", borderRadius: "var(--radius-md)", padding: "10px 12px", marginTop: 10 }}>
          <i className="ti ti-shield-check" style={{ fontSize: 15, flex: "none", marginTop: 1 }} aria-hidden="true" />
          <span style={{ fontSize: 12, lineHeight: 1.45, fontWeight: 600 }}>{t("s6_after")}</span>
        </div>
      </div>
    );
  })();

  // Rendu sur exactement deux lignes : la copie est deux phrases séparées
  // par ". " — on coupe dessus plutôt que de dépendre du wrap du conteneur.
  const [subLine1, subLine2] = showDraft ? t("s6_sub").split(". ") : ["", ""];

  const header = showDraft ? (
    <div style={{ marginBottom: isDesktop ? "1.75rem" : "1.25rem", display: "flex", alignItems: "stretch", gap: 14, textAlign: "left" }}>
      <div
        style={{
          width: 68, borderRadius: 16, flex: "none",
          background: "var(--sky-light)", color: "var(--sky)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <i className="ti ti-device-floppy" style={{ fontSize: 30 }} aria-hidden="true" />
      </div>
      <div>
        <h1 style={{ fontSize: isDesktop ? 21 : 18, marginBottom: 4, textAlign: "left" }}>
          {t("s6_title", { n: draftCount })}
        </h1>
        <p style={{ fontSize: 14.5, color: "var(--ink-3)", lineHeight: 1.5, textAlign: "justify" }}>
          {subLine1}.<br />
          {subLine2}
        </p>
      </div>
    </div>
  ) : (
    <div style={{ marginBottom: "2.5rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Logo size={84} stacked />
      <p style={{ fontSize: 14, color: "var(--ink-3)", marginTop: 12 }}>
        Vos finances, à deux
      </p>
    </div>
  );

  const formCol = (
    <div style={{ width: "100%", maxWidth: 400 }}>
      {header}

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        {mode === "signup" && (
          <input
            type="text"
            placeholder="Ton prénom"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={inputStyle}
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        <div style={{ position: "relative" }}>
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{ ...inputStyle, paddingRight: 40, width: "100%" }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              display: "flex",
              alignItems: "center",
              color: "var(--ink-3)",
            }}
          >
            <i
              className={showPassword ? "ti ti-eye-off" : "ti ti-eye"}
              style={{ fontSize: 18 }}
              aria-hidden="true"
            />
          </button>
        </div>

        {error && (
          <p style={{ fontSize: 13, color: "var(--red)", padding: "4px 2px" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          style={{
            marginTop: 8,
            background: "var(--ink)",
            color: "var(--bg)",
            border: "none",
            borderRadius: "var(--radius-md)",
            padding: 16,
            fontSize: 15,
            fontWeight: 500,
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "..." : mode === "login" ? "Se connecter" : "Crée ton compte"}
        </button>
      </form>
    </div>
  );

  const toggleLink = (
    <button
      onClick={() => {
        setMode(mode === "login" ? "signup" : "login");
        setError("");
      }}
      style={{
        marginTop: 0,
        background: "none",
        border: "none",
        fontSize: 15,
        color: "var(--ink-3)",
        textAlign: "center",
      }}
    >
      {mode === "login" ? (
        <>Pas encore de compte ? <span style={{ fontWeight: 700, color: "var(--sky)" }}>Créer un compte</span></>
      ) : (
        <>Déjà un compte ? <span style={{ fontWeight: 700, color: "var(--sky)" }}>Se connecter</span></>
      )}
    </button>
  );

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: draftPanel ? "flex-start" : "center",
        padding: draftPanel && !isDesktop ? "1.1rem 1.25rem" : "2rem 1.5rem",
        width: "100%",
      }}
    >
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Retour"
          style={{ position: "absolute", top: 18, left: 18, background: "none", border: "none", display: "flex", color: "var(--ink-3)", cursor: "pointer" }}
        >
          <i className="ti ti-arrow-left" style={{ fontSize: 22 }} aria-hidden="true" />
        </button>
      )}

      {draftPanel && <div style={{ marginBottom: isDesktop ? 48 : 28 }}><Logo size={36} /></div>}

      {draftPanel ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, width: "100%", justifyContent: "center" }}>
          <div
            style={{
              display: "flex",
              flexDirection: isDesktop ? "row" : "column",
              justifyContent: "center",
              alignItems: isDesktop ? "flex-start" : "stretch",
              gap: isDesktop ? 40 : 18,
              width: "100%",
            }}
          >
            <div style={{ flex: isDesktop ? "0 1 300px" : "none", maxWidth: isDesktop ? 300 : 400, width: isDesktop ? undefined : "100%", margin: isDesktop ? 0 : "0 auto" }}>{draftPanel}</div>
            <div style={{ flex: isDesktop ? "0 1 400px" : "none", maxWidth: 400, width: isDesktop ? undefined : "100%", margin: isDesktop ? 0 : "0 auto" }}>{formCol}</div>
          </div>
          <div style={{ marginTop: isDesktop ? 64 : 40 }}>{toggleLink}</div>
        </div>
      ) : (
        <>
          {formCol}
          <div style={{ marginTop: 20 }}>{toggleLink}</div>
        </>
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: "var(--radius-md)",
  border: "0.5px solid var(--rule)",
  background: "var(--bg-card)",
  fontSize: 15,
  outline: "none",
};

function friendlyError(code) {
  const map = {
    "auth/email-already-in-use": "Cet email est déjà utilisé.",
    "auth/invalid-email": "Email invalide.",
    "auth/weak-password": "Mot de passe trop court (6 caractères min).",
    "auth/user-not-found": "Aucun compte avec cet email.",
    "auth/wrong-password": "Mot de passe incorrect.",
    "auth/invalid-credential": "Email ou mot de passe incorrect.",
  };
  return map[code] || "Une erreur est survenue. Réessayez.";
}
