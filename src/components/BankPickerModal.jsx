import { useEffect, useState } from "react";
import { usePlaid } from "../hooks/usePlaid";
import { useAuth } from "../context/AuthContext";
import { useFinance } from "../context/FinanceContext";
import { useTranslation } from "../hooks/useTranslation";

// Modale de connexion bancaire, en deux étapes :
//   1. Région : Europe (Enable Banking, flux redirect) ou Amérique du Nord (Plaid).
//   2. Si Europe : pays + banque (catalogue Enable Banking via listAspsps) →
//      startEnableBanking redirige vers le consentement de la banque.
// La branche Amérique du Nord délègue au flux Plaid existant (onPlaid) — aucune
// 2ᵉ étape (la popup Plaid gère la recherche de banque elle-même).
//
// Le routage n'est PAS deviné : l'utilisateur choisit explicitement sa région.
// C'est un choix par compte (un couple peut avoir un compte FR + un compte US).

// Pays couverts par Enable Banking les plus courants pour l'app (endonymes).
const EB_COUNTRIES = [
  { code: "FR", flag: "🇫🇷", name: "France" },
  { code: "BE", flag: "🇧🇪", name: "Belgique" },
  { code: "LU", flag: "🇱🇺", name: "Luxembourg" },
  { code: "CH", flag: "🇨🇭", name: "Suisse" },
  { code: "DE", flag: "🇩🇪", name: "Deutschland" },
  { code: "ES", flag: "🇪🇸", name: "España" },
  { code: "IT", flag: "🇮🇹", name: "Italia" },
  { code: "NL", flag: "🇳🇱", name: "Nederland" },
  { code: "PT", flag: "🇵🇹", name: "Portugal" },
  { code: "IE", flag: "🇮🇪", name: "Ireland" },
  { code: "AT", flag: "🇦🇹", name: "Österreich" },
  { code: "FI", flag: "🇫🇮", name: "Suomi" },
  { code: "GB", flag: "🇬🇧", name: "United Kingdom" },
];

export default function BankPickerModal({ asset, onClose, onPlaid }) {
  const t = useTranslation();
  const { coupleId } = useAuth();
  const { language } = useFinance();
  const { startEnableBanking, listAspsps } = usePlaid();

  const [step, setStep] = useState("region"); // region | banks
  const [country, setCountry] = useState(language === "en" ? "GB" : "FR");
  const [banks, setBanks] = useState(null); // null = en cours, [] = vide
  const [query, setQuery] = useState("");
  const [error, setError] = useState(null);
  const [redirecting, setRedirecting] = useState(false);

  // Charge la liste des banques dès qu'on entre dans l'étape « banks » ou qu'on
  // change de pays. Erreur failed-precondition ⇒ provider dormant côté serveur.
  useEffect(() => {
    if (step !== "banks") return;
    let alive = true;
    // Écritures dans une IIFE async (pas dans le corps synchrone de l'effet).
    (async () => {
      setBanks(null);
      setError(null);
      try {
        const list = await listAspsps(country);
        if (alive) setBanks(list);
      } catch (e) {
        if (!alive) return;
        setBanks([]);
        setError(/precondition|not configured/i.test(String(e?.message)) ? "unavailable" : "error");
      }
    })();
    return () => { alive = false; };
  }, [step, country, listAspsps]);

  function chooseNorthAmerica() {
    onClose();
    onPlaid();
  }

  async function connectBank(bank) {
    setRedirecting(true);
    try {
      // Redirige le navigateur hors de l'app vers le consentement bancaire.
      await startEnableBanking(coupleId, asset.id, bank.name, bank.country || country);
    } catch {
      setRedirecting(false);
      setError("error");
    }
  }

  const filtered = (banks || []).filter((b) =>
    b.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "color-mix(in srgb, var(--ink) 40%, transparent)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 460, maxHeight: "85vh",
          background: "var(--bg)", borderRadius: "20px 20px 0 0",
          display: "flex", flexDirection: "column",
          boxShadow: "0 -8px 40px color-mix(in srgb, var(--ink) 16%, transparent)",
        }}
      >
        {/* En-tête */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", borderBottom: "0.5px solid var(--rule)" }}>
          {step === "banks" && (
            <button
              onClick={() => { setStep("region"); setQuery(""); }}
              aria-label={t("common_cancel")}
              style={iconBtn}
            >
              <i className="ti ti-arrow-left" style={{ fontSize: 18 }} aria-hidden="true" />
            </button>
          )}
          <h2 style={{ flex: 1, margin: 0, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--ink)" }}>
            {step === "region" ? t("bank_region_title") : t("bank_pick_bank")}
          </h2>
          <button onClick={onClose} aria-label={t("common_cancel")} style={iconBtn}>
            <i className="ti ti-x" style={{ fontSize: 18 }} aria-hidden="true" />
          </button>
        </div>

        {/* Étape 1 — région */}
        {step === "region" && (
          <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-3)", lineHeight: 1.45 }}>
              {t("bank_region_hint")}
            </p>
            <button onClick={() => setStep("banks")} style={regionCard}>
              <span style={{ fontSize: 26 }}>🇪🇺</span>
              <span style={{ flex: 1, textAlign: "left" }}>
                <span style={{ display: "block", fontWeight: 600, fontSize: 15, color: "var(--ink)" }}>{t("bank_region_europe")}</span>
                <span style={{ display: "block", fontSize: 12, color: "var(--ink-3)" }}>{t("bank_region_europe_sub")}</span>
              </span>
              <i className="ti ti-chevron-right" style={{ fontSize: 18, color: "var(--ink-3)" }} aria-hidden="true" />
            </button>
            <button onClick={chooseNorthAmerica} style={regionCard}>
              <span style={{ fontSize: 26 }}>🇺🇸</span>
              <span style={{ flex: 1, textAlign: "left" }}>
                <span style={{ display: "block", fontWeight: 600, fontSize: 15, color: "var(--ink)" }}>{t("bank_region_north_america")}</span>
                <span style={{ display: "block", fontSize: 12, color: "var(--ink-3)" }}>{t("bank_region_north_america_sub")}</span>
              </span>
              <i className="ti ti-chevron-right" style={{ fontSize: 18, color: "var(--ink-3)" }} aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Étape 2 — pays + banque (Europe) */}
        {step === "banks" && (
          <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
            <div style={{ padding: "14px 18px 10px", display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 500 }}>
                {t("bank_pick_country")}
                <select
                  value={country}
                  onChange={(e) => { setCountry(e.target.value); setQuery(""); }}
                  style={{
                    marginTop: 5, width: "100%", padding: "9px 10px", fontSize: 14,
                    background: "var(--bg)", border: "0.5px solid var(--rule)",
                    borderRadius: "var(--radius-md)", color: "var(--ink)",
                  }}
                >
                  {EB_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                  ))}
                </select>
              </label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("bank_search_placeholder")}
                style={{
                  width: "100%", padding: "9px 12px", fontSize: 14,
                  background: "var(--bg)", border: "0.5px solid var(--rule)",
                  borderRadius: "var(--radius-md)", color: "var(--ink)",
                }}
              />
            </div>

            <div style={{ overflowY: "auto", padding: "0 18px 18px", flex: 1 }}>
              {banks === null && (
                <p style={{ textAlign: "center", padding: 24, fontSize: 13, color: "var(--ink-3)" }}>
                  <i className="ti ti-loader-2 pw-spin" style={{ fontSize: 18, display: "inline-block" }} aria-hidden="true" />
                </p>
              )}
              {error === "unavailable" && (
                <p style={{ padding: 20, fontSize: 13, color: "var(--ink-3)", textAlign: "center", lineHeight: 1.5 }}>
                  {t("bank_eb_unavailable")}
                </p>
              )}
              {error === "error" && (
                <p style={{ padding: 20, fontSize: 13, color: "var(--red)", textAlign: "center" }}>
                  {t("bank_callback_error")}
                </p>
              )}
              {banks && banks.length > 0 && filtered.length === 0 && !error && (
                <p style={{ padding: 20, fontSize: 13, color: "var(--ink-3)", textAlign: "center" }}>
                  {t("bank_no_results")}
                </p>
              )}
              {filtered.map((bank) => (
                <button
                  key={`${bank.name}-${bank.country}`}
                  onClick={() => connectBank(bank)}
                  disabled={redirecting}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 12,
                    padding: "11px 8px", background: "none", border: "none",
                    borderBottom: "0.5px solid var(--rule)", cursor: "pointer", textAlign: "left",
                  }}
                >
                  {bank.logo
                    ? <img src={bank.logo} alt="" width={26} height={26} style={{ borderRadius: 6, objectFit: "contain", flexShrink: 0 }} />
                    : <span style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0, background: "color-mix(in srgb, var(--ink) 8%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ti ti-building-bank" style={{ fontSize: 15, color: "var(--ink-3)" }} aria-hidden="true" /></span>}
                  <span style={{ flex: 1, fontSize: 14, color: "var(--ink)" }}>{bank.name}</span>
                  <i className="ti ti-chevron-right" style={{ fontSize: 16, color: "var(--ink-3)" }} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        )}

        {redirecting && (
          <div style={{ padding: "10px 18px", fontSize: 12, color: "var(--sky)", textAlign: "center", borderTop: "0.5px solid var(--rule)" }}>
            <i className="ti ti-loader-2 pw-spin" style={{ fontSize: 14, display: "inline-block", marginRight: 6, verticalAlign: "middle" }} aria-hidden="true" />
            {t("bank_connecting")}
          </div>
        )}
      </div>
    </div>
  );
}

const iconBtn = {
  width: 32, height: 32, borderRadius: 99, flexShrink: 0,
  display: "flex", alignItems: "center", justifyContent: "center",
  background: "color-mix(in srgb, var(--ink) 6%, transparent)",
  border: "none", color: "var(--ink-2)", cursor: "pointer",
};

const regionCard = {
  display: "flex", alignItems: "center", gap: 14, width: "100%",
  padding: "14px 14px", background: "var(--bg)",
  border: "0.5px solid var(--rule)", borderRadius: "var(--radius-md)",
  cursor: "pointer",
};
