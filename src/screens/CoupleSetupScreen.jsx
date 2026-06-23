import { useState } from "react";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

function generateCoupleCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function CoupleSetupScreen() {
  const { user, setCoupleId } = useAuth();
  const [mode, setMode] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [createdCode, setCreatedCode] = useState("");
  const [pendingCoupleId, setPendingCoupleId] = useState(null);

  async function handleCreate() {
    setBusy(true);
    setError("");
    try {
      const code = generateCoupleCode();
      await setDoc(doc(db, "couples", code), {
        createdAt: Date.now(),
        members: [
          { uid: user.uid, name: user.displayName || "Moi" },
        ],
        defaultCurrency: "EUR",
      });
      // On enregistre le coupleId dans le profil SANS faire basculer l'écran
      // tout de suite, pour que la personne ait le temps de voir le code
      await setDoc(
        doc(db, "users", user.uid),
        { coupleId: code },
        { merge: true }
      );
      setPendingCoupleId(code);
      setCreatedCode(code);
    } catch (err) {
      setError("Erreur lors de la création. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const code = joinCode.trim().toUpperCase();
      const coupleDoc = await getDoc(doc(db, "couples", code));
      if (!coupleDoc.exists()) {
        setError("Code introuvable. Vérifiez l'orthographe.");
        setBusy(false);
        return;
      }
      const data = coupleDoc.data();
      const members = data.members || [];
      if (!members.find((m) => m.uid === user.uid)) {
        members.push({ uid: user.uid, name: user.displayName || "Moi" });
        await setDoc(doc(db, "couples", code), { members }, { merge: true });
      }
      // Sauvegarde permanente dans le profil utilisateur (sinon perdu au refresh)
      await setDoc(doc(db, "users", user.uid), { coupleId: code }, { merge: true });
      setCoupleId(code);
    } catch (err) {
      console.error("Erreur jointure couple:", err);
      setError(`Erreur: ${err.code || err.message}`);
    } finally {
      setBusy(false);
    }
  }

  if (createdCode) {
    return (
      <div style={screenStyle}>
        <i
          className="ti ti-heart-handshake"
          style={{ fontSize: 40, color: "var(--tang)", marginBottom: 16 }}
          aria-hidden="true"
        />
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Votre code de couple</h1>
        <p style={{ fontSize: 14, color: "var(--ink-3)", marginBottom: 24 }}>
          Partagez-le avec votre partenaire pour qu'il/elle rejoigne votre
          espace
        </p>
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--rule)",
            borderRadius: "var(--radius-lg)",
            padding: "24px",
            fontSize: 32,
            fontFamily: "var(--font-mono)",
            fontWeight: 500,
            letterSpacing: 4,
            marginBottom: 24,
          }}
        >
          {createdCode}
        </div>
        <button
          onClick={() => setCoupleId(pendingCoupleId)}
          style={{
            background: "var(--ink)",
            color: "var(--bg)",
            border: "none",
            borderRadius: "var(--radius-md)",
            padding: 16,
            fontSize: 15,
            fontWeight: 500,
            width: "100%",
          }}
        >
          C'est noté, continuer
        </button>
      </div>
    );
  }

  if (mode === "join") {
    return (
      <div style={screenStyle}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Rejoindre un couple</h1>
        <p style={{ fontSize: 14, color: "var(--ink-3)", marginBottom: 24 }}>
          Entrez le code partagé par votre partenaire
        </p>
        <form onSubmit={handleJoin} style={{ width: "100%" }}>
          <input
            type="text"
            placeholder="ABC123"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            maxLength={6}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "var(--radius-md)",
              border: "0.5px solid var(--rule)",
              background: "var(--bg-card)",
              fontSize: 22,
              fontFamily: "var(--font-mono)",
              textAlign: "center",
              letterSpacing: 3,
              textTransform: "uppercase",
              marginBottom: 12,
              outline: "none",
            }}
          />
          {error && (
            <p style={{ fontSize: 13, color: "var(--red)", marginBottom: 12 }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            style={{
              background: "var(--ink)",
              color: "var(--bg)",
              border: "none",
              borderRadius: "var(--radius-md)",
              padding: 16,
              fontSize: 15,
              fontWeight: 500,
              width: "100%",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? "..." : "Rejoindre"}
          </button>
        </form>
        <button
          onClick={() => setMode(null)}
          style={{
            marginTop: 16,
            background: "none",
            border: "none",
            fontSize: 13,
            color: "var(--ink-3)",
          }}
        >
          Retour
        </button>
      </div>
    );
  }

  return (
    <div style={screenStyle}>
      <i
        className="ti ti-users"
        style={{ fontSize: 40, color: "var(--tang)", marginBottom: 16 }}
        aria-hidden="true"
      />
      <h1 style={{ fontSize: 22, marginBottom: 8, textAlign: "center" }}>
        Bienvenue sur Pairwise
      </h1>
      <p
        style={{
          fontSize: 14,
          color: "var(--ink-3)",
          marginBottom: 32,
          textAlign: "center",
        }}
      >
        Créez votre espace ou rejoignez celui de votre partenaire
      </p>

      <button
        onClick={handleCreate}
        disabled={busy}
        style={{
          background: "var(--ink)",
          color: "var(--bg)",
          border: "none",
          borderRadius: "var(--radius-md)",
          padding: 16,
          fontSize: 15,
          fontWeight: 500,
          width: "100%",
          marginBottom: 12,
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? "Création..." : "Créer notre espace"}
      </button>
      <button
        onClick={() => setMode("join")}
        style={{
          background: "var(--bg-card)",
          color: "var(--ink)",
          border: "0.5px solid var(--rule)",
          borderRadius: "var(--radius-md)",
          padding: 16,
          fontSize: 15,
          fontWeight: 500,
          width: "100%",
        }}
      >
        Rejoindre avec un code
      </button>
      {error && (
        <p style={{ fontSize: 13, color: "var(--red)", marginTop: 12 }}>
          {error}
        </p>
      )}
    </div>
  );
}

const screenStyle = {
  minHeight: "100dvh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "2rem 1.5rem",
  textAlign: "center",
};
