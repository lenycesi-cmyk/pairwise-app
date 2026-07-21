import { Component } from "react";

// Filet de sécurité global : sans lui, la moindre exception lors d'un rendu
// démonte tout l'arbre React → écran blanc figé, sans interaction possible.
// Ici on capture l'erreur, on l'affiche, et on propose de recharger — avec une
// option « vider le cache » qui déregistre le Service Worker et purge les caches
// (couvre aussi le cas d'un app-shell PWA périmé qui référencerait de vieux
// chunks). Styles inline volontairement (l'erreur peut survenir avant/pendant
// le rendu de l'app, on ne dépend d'aucun composant applicatif).
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.handleReload = this.handleReload.bind(this);
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Visible dans la console pour diagnostic (remote debugging mobile inclus).
    console.error("App crash caught by ErrorBoundary:", error, info?.componentStack);
  }

  handleReload() {
    window.location.reload();
  }

  async handleReset() {
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // best-effort : on recharge quoi qu'il arrive
    }
    window.location.reload();
  }

  render() {
    if (!this.state.error) return this.props.children;

    const btn = {
      padding: "12px 18px",
      borderRadius: 12,
      border: "none",
      fontSize: 15,
      fontWeight: 600,
      cursor: "pointer",
      width: "100%",
      maxWidth: 320,
    };

    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          padding: 24,
          textAlign: "center",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          background: "#f8f8fc",
          color: "#1a1a2e",
        }}
      >
        <div style={{ fontSize: 40 }} aria-hidden="true">😕</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Une erreur est survenue</h1>
        <p style={{ fontSize: 14, color: "#4a4a6a", maxWidth: 380, margin: 0, lineHeight: 1.5 }}>
          L'application a rencontré un problème. Recharge la page ; si le souci
          persiste, vide le cache pour repartir sur une version propre.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6, width: "100%", alignItems: "center" }}>
          <button onClick={this.handleReload} style={{ ...btn, background: "#4f7cff", color: "#fff" }}>
            Recharger
          </button>
          <button onClick={this.handleReset} style={{ ...btn, background: "#fff", color: "#4f7cff", border: "1.5px solid #4f7cff" }}>
            Vider le cache et recharger
          </button>
        </div>
        <pre
          style={{
            marginTop: 12,
            maxWidth: "100%",
            overflowX: "auto",
            fontSize: 11,
            color: "#9a9ab0",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {String(this.state.error?.message || this.state.error)}
        </pre>
      </div>
    );
  }
}
