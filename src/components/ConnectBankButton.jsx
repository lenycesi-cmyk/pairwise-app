import { useState, useEffect, useCallback } from "react";
import { usePlaid } from "../hooks/usePlaid";
import { useAuth } from "../context/AuthContext";
import { useFinance } from "../context/FinanceContext";

/**
 * Button that initiates the Plaid Link flow for a given asset.
 * On success, exchanges the token and syncs the balance server-side.
 */
export default function ConnectBankButton({ asset, onSuccess }) {
  const { coupleId } = useAuth();
  const { syncBalance, disconnectBank } = usePlaid();
  const [status, setStatus] = useState("idle"); // idle | loading | syncing | error
  const [plaidReady, setPlaidReady] = useState(false);
  const [linkToken, setLinkToken] = useState(null);

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

  async function openPlaidLink() {
    setStatus("loading");
    try {
      // Fetch link token from our Cloud Function
      const fn = (await import("firebase/functions")).httpsCallable(
        (await import("firebase/functions")).getFunctions(undefined, "europe-west1"),
        "createLinkToken"
      );
      const res = await fn({ coupleId, assetId: asset.id, language: "fr" });
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

  async function handleSync() {
    setStatus("syncing");
    try {
      await syncBalance(coupleId, asset.id);
      setStatus("idle");
      onSuccess?.();
    } catch (err) {
      setStatus("error");
    }
  }

  async function handleDisconnect() {
    if (!confirm("Déconnecter ce compte bancaire ?")) return;
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
    ? new Date(asset.lastBankSync).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : null;

  if (isConnected) {
    return (
      <div style={{ marginTop: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--sage)", flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "var(--sage)", fontWeight: 500 }}>
            {asset.bankInstitution || "Banque connectée"}
            {asset.bankMask && ` ••${asset.bankMask}`}
          </span>
        </div>
        {lastSync && (
          <p style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 8 }}>
            Sync : {lastSync}
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
            {status === "syncing" ? "Sync..." : "Actualiser"}
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
            Déconnecter
          </button>
        </div>
      </div>
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
      {status === "loading" ? "Connexion..." : "Connecter ma banque"}
    </button>
  );
}
