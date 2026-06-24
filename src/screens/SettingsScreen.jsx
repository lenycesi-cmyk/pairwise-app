import { useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useFinance } from "../context/FinanceContext";
import { CURRENCIES } from "../data/categories";
import { uploadPhoto } from "../utils/photoUpload";

export default function SettingsScreen({ onOpenRecurring, onOpenCategories, onOpenDebt }) {
  const { coupleId, logout, user, updateProfilePhoto } = useAuth();
  const { defaultCurrency, updateDefaultCurrency, currencyMode, updateCurrencyMode, updateMemberPhoto } =
    useFinance();
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);

  async function handlePhotoSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const path = `profiles/${user.uid}.jpg`;
      const url = await uploadPhoto(file, path);
      await updateProfilePhoto(url);
      await updateMemberPhoto(user.uid, url);
    } catch (err) {
      console.error("Erreur upload photo:", err);
      alert("Impossible d'uploader la photo. Réessayez.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(coupleId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div style={{ padding: "1.5rem 1.25rem 6rem" }}>
      <h1 style={{ fontSize: 20, marginBottom: 20 }}>Paramètres</h1>

      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: 84,
            height: 84,
            borderRadius: "50%",
            background: user?.photoURL ? "transparent" : "var(--sky-light)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            position: "relative",
            overflow: "hidden",
            border: "2px solid var(--rule)",
          }}
        >
          {uploadingPhoto ? (
            <i className="ti ti-loader-2" style={{ fontSize: 24, color: "var(--ink-3)" }} aria-hidden="true" />
          ) : user?.photoURL ? (
            <img
              src={user.photoURL}
              alt="Photo de profil"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span style={{ fontSize: 28, fontWeight: 500, color: "var(--sky)" }}>
              {user?.displayName?.[0]?.toUpperCase() || "?"}
            </span>
          )}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: "var(--ink)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid var(--bg)",
            }}
          >
            <i className="ti ti-camera" style={{ fontSize: 12, color: "var(--bg)" }} aria-hidden="true" />
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoSelect}
          style={{ display: "none" }}
        />
      </div>

      <SectionLabel>Couple</SectionLabel>
      <Card>
        <Row label="Inviter votre partenaire">
          <button
            onClick={() => setShowCode(!showCode)}
            style={linkBtnStyle}
          >
            {showCode ? "Masquer" : "Afficher le code"}
          </button>
        </Row>
        {showCode && (
          <div
            style={{
              padding: "12px 0",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                flex: 1,
                fontFamily: "var(--font-mono)",
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: 3,
                textAlign: "center",
                background: "var(--bg)",
                padding: "10px 0",
                borderRadius: "var(--radius-md)",
              }}
            >
              {coupleId}
            </div>
            <button onClick={copyCode} style={iconBtnStyle} aria-label="Copier">
              <i
                className={copied ? "ti ti-check" : "ti ti-copy"}
                style={{ fontSize: 16, color: copied ? "var(--sage)" : "var(--ink)" }}
                aria-hidden="true"
              />
            </button>
          </div>
        )}
      </Card>

      <SectionLabel>Devise</SectionLabel>
      <Card>
        <Row label="Mode de devise par défaut">
          <div />
        </Row>
        <div style={{ display: "flex", gap: 6, padding: "8px 0 12px" }}>
          <ModeBtn
            active={currencyMode === "fixed"}
            onClick={() => updateCurrencyMode("fixed")}
          >
            Fixe
          </ModeBtn>
          <ModeBtn
            active={currencyMode === "last"}
            onClick={() => updateCurrencyMode("last")}
          >
            Dernière utilisée
          </ModeBtn>
        </div>
        <p style={{ fontSize: 11, color: "var(--ink-3)", paddingBottom: 10 }}>
          {currencyMode === "fixed"
            ? "La devise ci-dessous sera toujours proposée par défaut."
            : "La devise de votre dernière transaction sera proposée par défaut."}
        </p>

        {currencyMode === "fixed" && (
          <>
            <Row label="Devise affichée (résumés)">
              <div />
            </Row>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 0" }}>
              {CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  onClick={() => updateDefaultCurrency(c.code)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "var(--radius-md)",
                    border:
                      defaultCurrency === c.code
                        ? "0.5px solid var(--sky)"
                        : "0.5px solid var(--rule)",
                    background:
                      defaultCurrency === c.code ? "var(--sky-light)" : "var(--bg)",
                    color: defaultCurrency === c.code ? "var(--sky)" : "var(--ink)",
                    fontSize: 12,
                  }}
                >
                  {c.symbol} {c.code}
                </button>
              ))}
            </div>
          </>
        )}
        {currencyMode === "last" && (
          <p style={{ fontSize: 11, color: "var(--ink-3)", paddingBottom: 6 }}>
            Devise utilisée pour les résumés : {defaultCurrency}
          </p>
        )}
      </Card>

      <SectionLabel>Automatisation</SectionLabel>
      <Card>
        <div
          onClick={onOpenCategories}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "4px 0 12px",
            cursor: "pointer",
            borderBottom: "0.5px solid var(--rule)",
          }}
        >
          <i className="ti ti-tags" style={{ fontSize: 18, color: "var(--tang)" }} aria-hidden="true" />
          <span style={{ fontSize: 14, flex: 1 }}>Catégories</span>
          <i className="ti ti-chevron-right" style={{ fontSize: 14, color: "var(--ink-3)" }} aria-hidden="true" />
        </div>
        <div
          onClick={onOpenDebt}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 0",
            cursor: "pointer",
            borderBottom: "0.5px solid var(--rule)",
          }}
        >
          <i className="ti ti-users" style={{ fontSize: 18, color: "var(--sky)" }} aria-hidden="true" />
          <span style={{ fontSize: 14, flex: 1 }}>Qui doit quoi</span>
          <i className="ti ti-chevron-right" style={{ fontSize: 14, color: "var(--ink-3)" }} aria-hidden="true" />
        </div>
        <div
          onClick={onOpenRecurring}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 0 4px",
            cursor: "pointer",
          }}
        >
          <i className="ti ti-repeat" style={{ fontSize: 18, color: "var(--lavi)" }} aria-hidden="true" />
          <span style={{ fontSize: 14, flex: 1 }}>Transactions récurrentes</span>
          <i className="ti ti-chevron-right" style={{ fontSize: 14, color: "var(--ink-3)" }} aria-hidden="true" />
        </div>
      </Card>

      <SectionLabel>Compte</SectionLabel>
      <Card>
        <button
          onClick={logout}
          style={{
            width: "100%",
            background: "none",
            border: "none",
            color: "var(--red)",
            fontSize: 14,
            textAlign: "left",
            padding: "4px 0",
          }}
        >
          Se déconnecter
        </button>
      </Card>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p
      style={{
        fontSize: 11,
        letterSpacing: 1,
        textTransform: "uppercase",
        color: "var(--ink-3)",
        marginBottom: 8,
        marginTop: 18,
      }}
    >
      {children}
    </p>
  );
}

function Card({ children }) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        borderRadius: "var(--radius-lg)",
        border: "0.5px solid var(--rule)",
        padding: "0.75rem 1.25rem",
      }}
    >
      {children}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 0",
      }}
    >
      <span style={{ fontSize: 14 }}>{label}</span>
      {children}
    </div>
  );
}

function ModeBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: 8,
        borderRadius: "var(--radius-md)",
        border: active ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
        background: active ? "var(--sky-light)" : "var(--bg)",
        color: active ? "var(--sky)" : "var(--ink)",
        fontSize: 12,
        fontWeight: active ? 500 : 400,
      }}
    >
      {children}
    </button>
  );
}

const linkBtnStyle = {
  background: "none",
  border: "none",
  color: "var(--sky)",
  fontSize: 13,
  fontWeight: 500,
};

const iconBtnStyle = {
  width: 36,
  height: 36,
  borderRadius: "var(--radius-md)",
  border: "0.5px solid var(--rule)",
  background: "var(--bg-card)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
