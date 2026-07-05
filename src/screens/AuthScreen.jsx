import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import Logo from "../components/Logo";

export default function AuthScreen() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "2rem 1.5rem",
        // Standard des formulaires d'authentification : colonne étroite
        // centrée (~400px) plutôt que des champs étirés sur tout l'écran.
        width: "100%",
        maxWidth: 400,
        margin: "0 auto",
      }}
    >
      <div style={{ marginBottom: "2.5rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Logo size={84} stacked />
        <p style={{ fontSize: 14, color: "var(--ink-3)", marginTop: 12 }}>
          Vos finances, à deux
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        {mode === "signup" && (
          <input
            type="text"
            placeholder="Votre prénom"
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
          {busy ? "..." : mode === "login" ? "Se connecter" : "Créer un compte"}
        </button>
      </form>

      <button
        onClick={() => {
          setMode(mode === "login" ? "signup" : "login");
          setError("");
        }}
        style={{
          marginTop: 20,
          background: "none",
          border: "none",
          fontSize: 13,
          color: "var(--ink-3)",
          textAlign: "center",
        }}
      >
        {mode === "login"
          ? "Pas encore de compte ? Créer un compte"
          : "Déjà un compte ? Se connecter"}
      </button>
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
