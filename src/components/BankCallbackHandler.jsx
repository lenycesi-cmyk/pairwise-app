import { useEffect, useState } from "react";
import { usePlaid } from "../hooks/usePlaid";
import { useTranslation } from "../hooks/useTranslation";

// Lit l'URL une seule fois, au montage (hors rendu React → pas de setState dans
// un effet). Renvoie l'état initial + les paramètres à échanger. Nettoie l'URL
// tout de suite pour qu'un rafraîchissement ne rejoue pas l'échange (code à
// usage unique). `state` = "coupleId:assetId:uid".
function readCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  const isCallback = window.location.pathname.includes("/bank-callback") || (code && state);
  if (!isCallback) return { status: null };
  window.history.replaceState({}, "", "/");
  if (!code || !state) return { status: "expired" };
  const [coupleId, assetId] = state.split(":");
  if (!coupleId || !assetId) return { status: "error" };
  return { status: "working", coupleId, assetId, code };
}

// Jambe de retour du flux REDIRECT Enable Banking. Après consentement, la banque
// renvoie l'utilisateur sur ENABLE_BANKING_REDIRECT_URL (…/bank-callback?code=…
// &state=…). Firebase Hosting réécrit tout chemin vers index.html (SPA), donc
// l'app démarre ici : ce composant lit `code`/`state`, appelle `exchangeToken`
// (via finishEnableBanking) pour créer la session bancaire, puis nettoie l'URL.
//
// `state` = "coupleId:assetId:uid" (encodé côté back-end dans createLinkToken).
// Monté sous FinanceProvider, il ne s'active que lorsque l'utilisateur est déjà
// authentifié (couple présent) — l'échange de token exige l'auth.
//
// Le back-end écrit la connexion et met l'asset à jour (admin SDK) ; onSnapshot
// reflète l'état côté client, on n'écrit donc rien ici. On affiche juste la
// progression puis un accusé succès/échec.
export default function BankCallbackHandler() {
  const t = useTranslation();
  const { finishEnableBanking } = usePlaid();
  // Détection faite une fois au montage (initialiseur = pas de setState/effet).
  // null (pas un retour bancaire) | "working" | "success" | "error" | "expired"
  const [init] = useState(readCallback);
  const [status, setStatus] = useState(init.status);

  useEffect(() => {
    if (init.status !== "working") return; // seul l'échange async se fait ici
    let alive = true;
    finishEnableBanking(init.coupleId, init.assetId, init.code)
      .then(() => alive && setStatus("success"))
      .catch((e) => {
        // Un code déjà consommé / expiré renvoie une erreur explicite côté API.
        const msg = String(e?.message || "");
        if (alive) setStatus(/expired|already|invalid.*code|used/i.test(msg) ? "expired" : "error");
      });
    return () => { alive = false; };
  }, [init, finishEnableBanking]);

  if (!status) return null;

  const isError = status === "error" || status === "expired";
  const icon =
    status === "working" ? "ti-loader-2"
    : status === "success" ? "ti-circle-check"
    : "ti-alert-circle";
  const color =
    status === "working" ? "var(--sky)"
    : status === "success" ? "var(--sage)"
    : "var(--red)";
  const title =
    status === "working" ? t("bank_callback_finishing")
    : status === "success" ? t("bank_callback_success")
    : status === "expired" ? t("bank_callback_expired")
    : t("bank_callback_error");
  const hint =
    status === "success" ? t("bank_callback_success_hint")
    : isError ? t("bank_callback_error_hint")
    : null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      style={{
        position: "fixed", inset: 0, zIndex: 400,
        background: "color-mix(in srgb, var(--bg) 92%, transparent)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 340, width: "100%", textAlign: "center",
          background: "var(--card, var(--bg))", border: "0.5px solid var(--rule)",
          borderRadius: "var(--radius-lg, 16px)", padding: "28px 24px",
          boxShadow: "0 12px 40px color-mix(in srgb, var(--ink) 12%, transparent)",
        }}
      >
        <i
          className={`ti ${icon}${status === "working" ? " pw-spin" : ""}`}
          style={{ fontSize: 40, color, display: "inline-block" }}
          aria-hidden="true"
        />
        <h2 style={{ margin: "14px 0 0", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 17, color: "var(--ink)" }}>
          {title}
        </h2>
        {hint && (
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--ink-3)", lineHeight: 1.45 }}>
            {hint}
          </p>
        )}
        {status !== "working" && (
          <button
            onClick={() => setStatus(null)}
            style={{
              marginTop: 20, width: "100%", padding: "10px 0",
              fontSize: 14, fontWeight: 500,
              background: isError ? "var(--bg)" : "var(--sage-light, var(--bg))",
              border: `0.5px solid ${isError ? "var(--rule)" : "var(--sage)"}`,
              borderRadius: "var(--radius-md)",
              color: isError ? "var(--ink-2)" : "var(--sage)",
              cursor: "pointer",
            }}
          >
            {t("bank_callback_done")}
          </button>
        )}
      </div>
    </div>
  );
}
