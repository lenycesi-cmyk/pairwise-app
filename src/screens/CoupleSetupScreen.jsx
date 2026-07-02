import { useState } from "react";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { getInitial } from "../utils/memberColors";

function newPlaceholderId() {
  return `ph_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function generateCoupleCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function CoupleSetupScreen() {
  const { user, setCoupleId, setOnboardingComplete } = useAuth();
  // null = ask solo vs couple first; "couple-choice" = create/join buttons;
  // "join" = join-by-code form. Solo skips straight to handleCreate below.
  const [mode, setMode] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [createdCode, setCreatedCode] = useState("");
  const [pendingCoupleId, setPendingCoupleId] = useState(null);
  const [partnerName, setPartnerName] = useState("");
  const [placeholderMember, setPlaceholderMember] = useState(null);
  const [confirmName, setConfirmName] = useState("");
  const [joiningCode, setJoiningCode] = useState(null);

  async function handleCreate({ showCode = true } = {}) {
    setBusy(true);
    setError("");
    try {
      const code = generateCoupleCode();
      await setDoc(doc(db, "couples", code), {
        createdAt: Date.now(),
        members: [
          { uid: user.uid, memberId: user.uid, name: user.displayName || "Moi" },
        ],
        memberUids: [user.uid],
        defaultCurrency: "EUR",
      });
      // onboardingComplete: false triggers the setup wizard right after this
      // screen (see App.jsx) — only set on a genuinely new couple.
      await setDoc(
        doc(db, "users", user.uid),
        { coupleId: code, onboardingComplete: false },
        { merge: true }
      );
      if (showCode) {
        // On enregistre le coupleId dans le profil SANS faire basculer l'écran
        // tout de suite, pour que la personne ait le temps de voir le code
        setPendingCoupleId(code);
        setCreatedCode(code);
      } else {
        setOnboardingComplete(false);
        setCoupleId(code);
      }
    } catch (err) {
      setError("Erreur lors de la création. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  async function handleContinueFromCode() {
    const name = partnerName.trim();
    if (name) {
      setBusy(true);
      try {
        const coupleRef = doc(db, "couples", pendingCoupleId);
        const coupleDoc = await getDoc(coupleRef);
        const members = coupleDoc.data()?.members || [];
        // A placeholder stands in for a partner who hasn't signed up yet:
        // no uid until they join with the code and claim it (see handleJoin).
        members.push({ uid: null, memberId: newPlaceholderId(), name });
        await setDoc(coupleRef, { members }, { merge: true });
      } catch (err) {
        console.error("Erreur ajout partenaire:", err);
      } finally {
        setBusy(false);
      }
    }
    setOnboardingComplete(false);
    setCoupleId(pendingCoupleId);
  }

  async function finalizeJoin(code) {
    // Permanent record on the user profile (survives refresh) — join always
    // lands back on Home, never the wizard: either it's a genuinely solo
    // join (existing code path, unchanged) or a placeholder claim, whose
    // shared data already exists (see handleConfirmIdentity).
    await setDoc(doc(db, "users", user.uid), { coupleId: code, onboardingComplete: false }, { merge: true });
    setOnboardingComplete(false);
    setCoupleId(code);
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

      if (members.find((m) => m.uid === user.uid)) {
        // Already a member (e.g. re-joining after a refresh) — no-op.
        await finalizeJoin(code);
        return;
      }

      const placeholder = members.find((m) => m.uid === null);
      if (placeholder) {
        setPlaceholderMember(placeholder);
        setConfirmName(placeholder.name);
        setJoiningCode(code);
        setMode("confirm-identity");
        setBusy(false);
        return;
      }

      const realCount = members.filter((m) => m.uid !== null).length;
      if (realCount >= 2) {
        setError("Cet espace est déjà complet (2 membres maximum).");
        setBusy(false);
        return;
      }
      members.push({ uid: user.uid, memberId: user.uid, name: user.displayName || "Moi" });
      await setDoc(
        doc(db, "couples", code),
        { members, memberUids: members.map((m) => m.uid) },
        { merge: true }
      );
      await finalizeJoin(code);
    } catch (err) {
      console.error("Erreur jointure couple:", err);
      setError(`Erreur: ${err.code || err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmIdentity() {
    setBusy(true);
    setError("");
    try {
      const coupleRef = doc(db, "couples", joiningCode);
      const coupleDoc = await getDoc(coupleRef);
      const members = coupleDoc.data()?.members || [];
      const updated = members.map((m) =>
        m.memberId === placeholderMember.memberId
          ? { ...m, uid: user.uid, name: confirmName.trim() || m.name }
          : m
      );
      await setDoc(
        coupleRef,
        { members: updated, memberUids: updated.map((m) => m.uid) },
        { merge: true }
      );
      // The shared data (recurring/income/investments/possessions) was
      // already attributed to this placeholder by whoever created the
      // space — no wizard needed, straight to Home.
      await setDoc(doc(db, "users", user.uid), { coupleId: joiningCode, onboardingComplete: true }, { merge: true });
      setOnboardingComplete(true);
      setCoupleId(joiningCode);
    } catch (err) {
      console.error("Erreur confirmation identité:", err);
      setError(`Erreur: ${err.code || err.message}`);
      setBusy(false);
    }
  }

  function handleDeclineIdentity() {
    setError(`Ce code correspond à l'espace de ${placeholderMember.name} et d'une autre personne — contacte la personne qui te l'a partagé.`);
    setMode("join");
    setPlaceholderMember(null);
    setJoiningCode(null);
  }

  if (createdCode) {
    return (
      <div style={screenStyle}>
        <i
          className="ti ti-heart-handshake"
          style={{ fontSize: 40, color: "var(--tang)", marginBottom: 16 }}
          aria-hidden="true"
        />
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Votre code couple</h1>
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
            marginBottom: 16,
          }}
        >
          {createdCode}
        </div>
        <p style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 24 }}>
          Tu pourras toujours le retrouver plus tard dans Réglages → Couple.
        </p>

        <div style={{ width: "100%", textAlign: "left", marginBottom: 24 }}>
          <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}>
            Comment s'appelle ton/ta partenaire ? (optionnel)
          </p>
          <input
            type="text"
            value={partnerName}
            onChange={(e) => setPartnerName(e.target.value)}
            placeholder="Prénom"
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: "var(--radius-md)",
              border: "0.5px solid var(--rule)",
              background: "var(--bg-card)",
              fontSize: 15,
              outline: "none",
            }}
          />
          <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 6 }}>
            Iel apparaîtra déjà dans ton espace — tu pourras lui attribuer des
            dépenses avant même qu'iel ait rejoint avec le code.
          </p>
        </div>

        <button
          onClick={handleContinueFromCode}
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
          {busy ? "..." : "C'est noté, continuer"}
        </button>
      </div>
    );
  }

  if (mode === "confirm-identity" && placeholderMember) {
    return (
      <div style={screenStyle}>
        <div
          style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "var(--sky-light)", color: "var(--sky)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, fontWeight: 600, marginBottom: 16,
          }}
        >
          {getInitial(confirmName)}
        </div>
        <input
          type="text"
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
          style={{
            fontSize: 22, fontWeight: 600, textAlign: "center",
            border: "none", borderBottom: "1px solid var(--rule)",
            outline: "none", background: "transparent",
            padding: "4px 0", marginBottom: 4, width: "100%",
          }}
        />
        <p style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 16 }}>Es-tu cette personne ?</p>
        <p style={{ fontSize: 14, color: "var(--ink-3)", marginBottom: 32 }}>
          {placeholderMember.name} a créé cet espace et t'a déjà attribué des dépenses partagées.
        </p>
        {error && (
          <p style={{ fontSize: 13, color: "var(--red)", marginBottom: 12 }}>{error}</p>
        )}
        <button
          onClick={handleConfirmIdentity}
          disabled={busy}
          style={{
            background: "var(--ink)", color: "var(--bg)", border: "none",
            borderRadius: "var(--radius-md)", padding: 16, fontSize: 15,
            fontWeight: 500, width: "100%", marginBottom: 12,
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "..." : "Oui, c'est moi"}
        </button>
        <button
          onClick={handleDeclineIdentity}
          disabled={busy}
          style={{
            background: "var(--bg-card)", color: "var(--ink)",
            border: "0.5px solid var(--rule)", borderRadius: "var(--radius-md)",
            padding: 16, fontSize: 15, fontWeight: 500, width: "100%",
          }}
        >
          Non, ce n'est pas moi
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
          onClick={() => setMode("couple-choice")}
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

  if (mode === "couple-choice") {
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
          onClick={() => handleCreate({ showCode: true })}
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
        <button
          onClick={() => setMode(null)}
          style={{ marginTop: 16, background: "none", border: "none", fontSize: 13, color: "var(--ink-3)" }}
        >
          Retour
        </button>
      </div>
    );
  }

  // Écran initial : seul·e ou en couple. Solo crée un espace à un seul
  // membre en arrière-plan (sans montrer de code, sans forcer une invitation)
  // — l'option d'inviter un partenaire reste accessible plus tard depuis
  // Réglages, donc rien n'est perdu à choisir "seul·e" maintenant.
  return (
    <div style={screenStyle}>
      <i
        className="ti ti-heart"
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
        Tu prévois d'utiliser Pairwise seul·e ou en couple ? Tu pourras
        toujours changer plus tard.
      </p>

      <button
        onClick={() => setMode("couple-choice")}
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
        En couple
      </button>
      <button
        onClick={() => handleCreate({ showCode: false })}
        disabled={busy}
        style={{
          background: "var(--bg-card)",
          color: "var(--ink)",
          border: "0.5px solid var(--rule)",
          borderRadius: "var(--radius-md)",
          padding: 16,
          fontSize: 15,
          fontWeight: 500,
          width: "100%",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? "Création..." : "Seul·e"}
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
