import { useState, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useFinance } from "../context/FinanceContext";
import { CURRENCIES } from "../data/categories";
import { uploadPhoto } from "../utils/photoUpload";
import { AVATAR_COLOR_PALETTE, buildMemberColorMap, getInitial } from "../utils/memberColors";
import { useTranslation } from "../hooks/useTranslation";

export default function SettingsScreen({ onOpenRecurring, onOpenCategories, onOpenTheme, onOpenLanguage }) {
  const t = useTranslation();
  const { coupleId, logout, user, updateProfilePhoto, updateDisplayName, deleteAccount } = useAuth();
  const {
    defaultCurrency,
    updateDefaultCurrency,
    currencyMode,
    updateCurrencyMode,
    updateMemberPhoto,
    updateMemberName,
    updateMemberAvatarColor,
    members,
    transactions,
    coupleName,
    updateCoupleName,
  } = useFinance();
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.displayName || "");
  const [editingCoupleName, setEditingCoupleName] = useState(false);
  const [coupleNameInput, setCoupleNameInput] = useState(coupleName || "");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  function exportCSV() {
    const header = ["Date", "Type", "Catégorie", "Sous-catégorie", "Description", "Montant", "Devise", "Membre"];
    const rows = [...transactions]
      .sort((a, b) => b.date - a.date)
      .map((tx) => [
        new Date(tx.date).toLocaleDateString("fr-FR"),
        tx.type,
        tx.category,
        tx.subcategory || "",
        (tx.description || "").replace(/,/g, " "),
        tx.amount,
        tx.currency,
        members.find((m) => m.uid === tx.memberId)?.name || tx.memberId || "",
      ]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pairwise-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDeleteAccount() {
    setDeleteError("");
    setDeleteLoading(true);
    try {
      await deleteAccount(deletePassword, members);
    } catch (err) {
      setDeleteError(
        err.code === "auth/wrong-password" || err.code === "auth/invalid-credential"
          ? t("settings_delete_wrong_password")
          : err.message
      );
      setDeleteLoading(false);
    }
  }

  function requestNotificationPermission() {
    if (typeof Notification === "undefined" || notificationStatus === "granted") return;
    Notification.requestPermission().then(setNotificationStatus);
  }

  const currentMember = members.find((m) => m.uid === user?.uid);
  const memberColorMap = buildMemberColorMap(members);
  const myColor = memberColorMap[user?.uid] || AVATAR_COLOR_PALETTE[0];

  async function handleSaveName() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    await updateDisplayName(trimmed);
    await updateMemberName(user.uid, trimmed);
    setEditingName(false);
  }

  async function handleSaveCoupleName() {
    await updateCoupleName(coupleNameInput.trim());
    setEditingCoupleName(false);
  }

  async function handlePickColor(colorKey) {
    await updateMemberAvatarColor(user.uid, colorKey);
    setShowColorPicker(false);
  }

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
      <h1 style={{ fontSize: 20, marginBottom: 20 }}>{t("settings_title")}</h1>

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

      {/* Nom éditable */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
        {editingName ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
              autoFocus
              style={{
                fontSize: 16,
                fontWeight: 500,
                textAlign: "center",
                border: "none",
                borderBottom: "1px solid var(--rule)",
                outline: "none",
                background: "transparent",
                width: 160,
              }}
            />
            <button
              onClick={handleSaveName}
              aria-label="Valider"
              style={{ background: "none", border: "none", color: "var(--sage)" }}
            >
              <i className="ti ti-check" style={{ fontSize: 18 }} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setNameInput(user?.displayName || ""); setEditingName(true); }}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "none", border: "none",
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 500, color: "var(--ink)" }}>
              {user?.displayName || "Sans nom"}
            </span>
            <i className="ti ti-pencil" style={{ fontSize: 13, color: "var(--ink-3)" }} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Couleur de l'icône */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
        <button
          onClick={() => setShowColorPicker(!showColorPicker)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "none", border: "none", fontSize: 12, color: "var(--ink-3)",
          }}
        >
          <span
            style={{
              width: 14, height: 14, borderRadius: "50%",
              background: myColor.bg, border: `1.5px solid ${myColor.text}`,
            }}
          />
          Couleur de l'icône
        </button>
      </div>

      {showColorPicker && (
        <div
          style={{
            display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap",
            marginBottom: 20, padding: "0.75rem", background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)", border: "0.5px solid var(--rule)",
          }}
        >
          {AVATAR_COLOR_PALETTE.map((c) => (
            <button
              key={c.key}
              onClick={() => handlePickColor(c.key)}
              aria-label={c.key}
              style={{
                width: 32, height: 32, borderRadius: "50%",
                background: c.bg, color: c.text,
                border: currentMember?.avatarColor === c.key ? `2px solid ${c.text}` : "2px solid transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 600,
              }}
            >
              {getInitial(user?.displayName)}
            </button>
          ))}
        </div>
      )}

      <SectionLabel>{t("settings_couple")}</SectionLabel>
      <Card>
        <Row label={t("settings_couple_name")}>
          {editingCoupleName ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="text"
                value={coupleNameInput}
                onChange={(e) => setCoupleNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveCoupleName()}
                autoFocus
                placeholder={t("settings_couple_name_placeholder")}
                style={{
                  fontSize: 14,
                  textAlign: "right",
                  border: "none",
                  borderBottom: "1px solid var(--rule)",
                  outline: "none",
                  background: "transparent",
                  width: 140,
                }}
              />
              <button onClick={handleSaveCoupleName} aria-label="Valider" style={{ background: "none", border: "none", color: "var(--sage)" }}>
                <i className="ti ti-check" style={{ fontSize: 16 }} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setCoupleNameInput(coupleName || ""); setEditingCoupleName(true); }}
              style={linkBtnStyle}
            >
              {coupleName || t("settings_couple_name_placeholder")}
            </button>
          )}
        </Row>
        <Row label={t("settings_invite_partner")}>
          <button
            onClick={() => setShowCode(!showCode)}
            style={linkBtnStyle}
          >
            {showCode ? t("settings_hide_code") : t("settings_show_code")}
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

      <SectionLabel>{t("settings_currency")}</SectionLabel>
      <Card>
        <Row label={t("settings_currency_mode")}>
          <div />
        </Row>
        <div style={{ display: "flex", gap: 6, padding: "8px 0 12px" }}>
          <ModeBtn
            active={currencyMode === "fixed"}
            onClick={() => updateCurrencyMode("fixed")}
          >
            {t("settings_fixed")}
          </ModeBtn>
          <ModeBtn
            active={currencyMode === "last"}
            onClick={() => updateCurrencyMode("last")}
          >
            {t("settings_last_used")}
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

      <SectionLabel>{t("settings_automation")}</SectionLabel>
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
          <span style={{ fontSize: 14, flex: 1 }}>{t("settings_categories")}</span>
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
            borderBottom: "0.5px solid var(--rule)",
          }}
        >
          <i className="ti ti-repeat" style={{ fontSize: 18, color: "var(--lavi)" }} aria-hidden="true" />
          <span style={{ fontSize: 14, flex: 1 }}>{t("settings_recurring")}</span>
          <i className="ti ti-chevron-right" style={{ fontSize: 14, color: "var(--ink-3)" }} aria-hidden="true" />
        </div>
        <div
          onClick={requestNotificationPermission}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 0 4px",
            cursor: notificationStatus === "granted" ? "default" : "pointer",
          }}
        >
          <i className="ti ti-bell" style={{ fontSize: 18, color: "var(--sage)" }} aria-hidden="true" />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, margin: 0 }}>{t("settings_budget_alerts")}</p>
            <p style={{ fontSize: 11, color: "var(--ink-3)", margin: "2px 0 0" }}>
              {t("settings_budget_alerts_hint")}
            </p>
          </div>
          {notificationStatus === "granted" ? (
            <i className="ti ti-check" style={{ fontSize: 16, color: "var(--sage)" }} aria-hidden="true" />
          ) : notificationStatus === "denied" ? (
            <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{t("settings_notifications_denied")}</span>
          ) : (
            <span style={{ fontSize: 12, color: "var(--sky)" }}>{t("settings_notifications_enable")}</span>
          )}
        </div>
      </Card>

      <SectionLabel>{t("settings_appearance")}</SectionLabel>
      <Card>
        <div
          onClick={onOpenTheme}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "4px 0 12px",
            cursor: "pointer",
            borderBottom: "0.5px solid var(--rule)",
          }}
        >
          <i className="ti ti-palette" style={{ fontSize: 18, color: "var(--blush)" }} aria-hidden="true" />
          <span style={{ fontSize: 14, flex: 1 }}>{t("settings_theme")}</span>
          <i className="ti ti-chevron-right" style={{ fontSize: 14, color: "var(--ink-3)" }} aria-hidden="true" />
        </div>
        <div
          onClick={onOpenLanguage}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 0 4px",
            cursor: "pointer",
          }}
        >
          <i className="ti ti-language" style={{ fontSize: 18, color: "var(--sky)" }} aria-hidden="true" />
          <span style={{ fontSize: 14, flex: 1 }}>{t("settings_language")}</span>
          <i className="ti ti-chevron-right" style={{ fontSize: 14, color: "var(--ink-3)" }} aria-hidden="true" />
        </div>
      </Card>

      <SectionLabel>{t("settings_legal")}</SectionLabel>
      <Card>
        <a
          href="/privacy.html"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "4px 0", textDecoration: "none", color: "var(--ink)",
            fontSize: 14, borderBottom: "0.5px solid var(--rule)", paddingBottom: 12, marginBottom: 12,
          }}
        >
          <span>{t("settings_privacy_policy")}</span>
          <i className="ti ti-external-link" style={{ fontSize: 14, color: "var(--ink-3)" }} aria-hidden="true" />
        </a>
        <a
          href="/terms.html"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "4px 0", textDecoration: "none", color: "var(--ink)", fontSize: 14,
          }}
        >
          <span>{t("settings_terms")}</span>
          <i className="ti ti-external-link" style={{ fontSize: 14, color: "var(--ink-3)" }} aria-hidden="true" />
        </a>
      </Card>

      <SectionLabel>{t("settings_account")}</SectionLabel>
      <Card>
        <button
          onClick={exportCSV}
          style={{
            width: "100%", background: "none", border: "none",
            color: "var(--sky)", fontSize: 14, textAlign: "left",
            padding: "4px 0", borderBottom: "0.5px solid var(--rule)",
            paddingBottom: 12, marginBottom: 12, display: "flex",
            alignItems: "center", gap: 8, cursor: "pointer",
          }}
        >
          <i className="ti ti-download" style={{ fontSize: 15 }} aria-hidden="true" />
          {t("settings_export_data")}
        </button>
        <button
          onClick={logout}
          style={{
            width: "100%", background: "none", border: "none",
            color: "var(--ink-2)", fontSize: 14, textAlign: "left",
            padding: "4px 0", borderBottom: "0.5px solid var(--rule)",
            paddingBottom: 12, marginBottom: 12, cursor: "pointer",
          }}
        >
          {t("settings_logout")}
        </button>
        <button
          onClick={() => setShowDeleteModal(true)}
          style={{
            width: "100%", background: "none", border: "none",
            color: "var(--red)", fontSize: 14, textAlign: "left",
            padding: "4px 0", cursor: "pointer",
          }}
        >
          {t("settings_delete_account")}
        </button>
      </Card>

      {showDeleteModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000, padding: 24,
        }}>
          <div style={{
            background: "var(--bg)", borderRadius: "var(--radius-lg)",
            padding: 24, width: "100%", maxWidth: 360,
          }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, color: "var(--red)" }}>
              {t("settings_delete_account")}
            </h3>
            <p style={{ fontSize: 14, color: "var(--ink-2)", marginBottom: 16 }}>
              {t("settings_delete_warning")}
            </p>
            <button
              onClick={exportCSV}
              style={{
                width: "100%", padding: "10px 0", marginBottom: 16,
                background: "var(--sky-light)", border: "0.5px solid var(--sky)",
                borderRadius: "var(--radius-md)", color: "var(--sky)",
                fontSize: 14, fontWeight: 500, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              <i className="ti ti-download" aria-hidden="true" />
              {t("settings_export_before_delete")}
            </button>
            <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 8 }}>
              {t("settings_delete_confirm_password")}
            </p>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder={t("settings_password_placeholder")}
              style={{
                width: "100%", padding: "10px 12px", marginBottom: 8,
                border: "0.5px solid var(--rule)", borderRadius: "var(--radius-md)",
                background: "var(--bg)", color: "var(--ink)", fontSize: 14,
              }}
            />
            {deleteError && (
              <p style={{ fontSize: 13, color: "var(--red)", marginBottom: 8 }}>{deleteError}</p>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                onClick={() => { setShowDeleteModal(false); setDeletePassword(""); setDeleteError(""); }}
                style={{
                  flex: 1, padding: "10px 0", background: "none",
                  border: "0.5px solid var(--rule)", borderRadius: "var(--radius-md)",
                  color: "var(--ink-2)", fontSize: 14, cursor: "pointer",
                }}
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={!deletePassword || deleteLoading}
                style={{
                  flex: 1, padding: "10px 0", background: "var(--red)",
                  border: "none", borderRadius: "var(--radius-md)",
                  color: "#fff", fontSize: 14, fontWeight: 600,
                  cursor: deletePassword && !deleteLoading ? "pointer" : "not-allowed",
                  opacity: deletePassword && !deleteLoading ? 1 : 0.5,
                }}
              >
                {deleteLoading ? "..." : t("settings_delete_confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
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
