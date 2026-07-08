import { useState, useEffect } from "react";
import { usePlaid } from "../hooks/usePlaid";
import { useAuth } from "../context/AuthContext";
import { useFinance } from "../context/FinanceContext";
import { useTranslation } from "../hooks/useTranslation";

/**
 * Button that initiates the Plaid Link flow for a given asset.
 * On success, exchanges the token and syncs the balance server-side.
 *
 * `compact` renders a small inline chip (icon + short label) meant to sit in
 * the asset row between the name and the balance — used only before a bank is
 * connected. Once connected, the full management block (sync/disconnect) is
 * rendered below the row regardless of `compact`.
 */
export default function ConnectBankButton({ asset, onSuccess, compact = false }) {
  const { coupleId } = useAuth();
  const { language } = useFinance();
  const t = useTranslation();
  const { syncBalance, disconnectBank } = usePlaid();
  const [status, setStatus] = useState("idle"); // idle | loading | syncing | error
  const [plaidReady, setPlaidReady] = useState(false);

  // Load Plaid Link script once
  useEffect(() => {
    if (document.getElementById("plaid-link-script")) {
      setPlaidReady(true);
      return;
    }
    const script = document.createElement("script");
    script.id = "plaid-link-script";
    script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
    script.onload = () => setPlaidReady(true);
    document.head.appendChild(script);
  }, []);

  async function openPlaidLink(e) {
    e?.stopPropagation();
    setStatus("loading");
    try {
      // Fetch link token from our Cloud Function
      const fn = (await import("firebase/functions")).httpsCallable(
        (await import("firebase/functions")).getFunctions(undefined, "europe-west1"),
        "createLinkToken"
      );
      const res = await fn({ coupleId, assetId: asset.id, language });
      const token = res.data.linkToken;

      // Open Plaid Link
      const handler = window.Plaid.create({
        token,
        onSuccess: async (publicToken, metadata) => {
          setStatus("syncing");
          try {
            const exchangeFn = (await import("firebase/functions")).httpsCallable(
              (await import("firebase/functions")).getFunctions(undefined, "europe-west1"),
              "exchangeToken"
            );
            const account = metadata.accounts?.[0];
            await exchangeFn({
              coupleId,
              assetId: asset.id,
              publicToken,
              accountId: account?.id,
              institutionName: metadata.institution?.name,
            });
            setStatus("idle");
            onSuccess?.();
          } catch (err) {
            console.error("exchangeToken error:", err);
            setStatus("error");
          }
        },
        onExit: () => setStatus("idle"),
      });
      handler.open();
    } catch (err) {
      console.error("createLinkToken error:", err);
      setStatus("error");
    }
  }

  async function handleSync(e) {
    e?.stopPropagation();
    setStatus("syncing");
    try {
      await syncBalance(coupleId, asset.id);
      setStatus("idle");
      onSuccess?.();
    } catch (err) {
      setStatus("error");
    }
  }

  async function handleDisconnect(e) {
    e?.stopPropagation();
    if (!confirm(t("bank_disconnect_confirm"))) return;
    setStatus("loading");
    try {
      await disconnectBank(coupleId, asset.id);
      setStatus("idle");
      onSuccess?.();
    } catch (err) {
      setStatus("error");
    }
  }

  const isConnected = asset.bankConnected;
  const lastSync = asset.lastBankSync
    ? new Date(asset.lastBankSync).toLocaleString(language === "en" ? "en-US" : "fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : null;

  if (isConnected) {
    return (
      <div style={{ marginTop: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--sage)", flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "var(--sage)", fontWeight: 500 }}>
            {asset.bankInstitution || t("bank_connected")}
            {asset.bankMask && ` ••${asset.bankMask}`}
          </span>
        </div>
        {lastSync && (
          <p style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 8 }}>
            {t("bank_last_sync")} : {lastSync}
          </p>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={handleSync}
            disabled={status === "syncing"}
            style={{
              flex: 1, padding: "7px 0", fontSize: 12, fontWeight: 500,
              background: "var(--bg)", border: "0.5px solid var(--rule)",
              borderRadius: "var(--radius-md)", color: "var(--sky)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            }}
          >
            <i className={`ti ${status === "syncing" ? "ti-loader-2" : "ti-refresh"}`} style={{ fontSize: 13 }} aria-hidden="true" />
            {status === "syncing" ? t("bank_syncing") : t("bank_refresh")}
          </button>
          <button
            onClick={handleDisconnect}
            disabled={status === "loading"}
            style={{
              padding: "7px 12px", fontSize: 12,
              background: "none", border: "0.5px solid var(--rule)",
              borderRadius: "var(--radius-md)", color: "var(--red)",
            }}
          >
            {t("bank_disconnect")}
          </button>
        </div>
      </div>
    );
  }

  // Compact inline chip (icon + short label) — sits in the row between the
  // account name and the balance.
  if (compact) {
    return (
      <button
        onClick={openPlaidLink}
        disabled={status === "loading" || !plaidReady}
        style={{
          padding: "5px 10px",
          fontSize: 12,
          fontWeight: 500,
          background: "var(--sky-light)",
          border: "0.5px solid var(--sky)",
          borderRadius: 99,
          color: "var(--sky)",
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        <i className={`ti ${status === "loading" ? "ti-loader-2" : "ti-building-bank"}`} style={{ fontSize: 14 }} aria-hidden="true" />
        {status === "loading" ? t("bank_connecting") : t("bank_connect")}
      </button>
    );
  }

  return (
    <button
      onClick={openPlaidLink}
      disabled={status === "loading" || !plaidReady}
      style={{
        marginTop: 10,
        width: "100%",
        padding: "9px 0",
        fontSize: 13,
        fontWeight: 500,
        background: "var(--sky-light)",
        border: "0.5px solid var(--sky)",
        borderRadius: "var(--radius-md)",
        color: "var(--sky)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      <i className={`ti ${status === "loading" ? "ti-loader-2" : "ti-building-bank"}`} style={{ fontSize: 15 }} aria-hidden="true" />
      {status === "loading" ? t("bank_connecting") : t("bank_connect")}
    </button>
  );
}
