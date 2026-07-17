import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useTranslation } from "../hooks/useTranslation";
import Avatar from "./Avatar";
import { buildMemberColorMap } from "../utils/memberColors";
import { getMemberKey } from "../utils/members";

const QUICK_EMOJIS = ["❤️", "😂", "😮", "👍", "🤔"];

// Le picker GIPHY n'est chargé (lazy) que si une clé API est configurée
// ET que l'utilisateur ouvre le tiroir GIF — zéro impact bundle sinon.
const HAS_GIF_KEY = !!import.meta.env.VITE_GIPHY_API_KEY;
const GifPicker = lazy(() => import("./GifPicker"));

// Un emoji seul (éventuellement répété) s'affiche en grand, sans bulle —
// même convention qu'iMessage/WhatsApp.
function isEmojiOnly(text) {
  return text && text.length <= 8 && /^\p{Extended_Pictographic}+$/u.test(text.replace(/️/g, ""));
}

// Fil de discussion présentationnel, réutilisé pour les transactions ET les
// assets. L'appelant fournit les commentaires (live via onSnapshot), la clé du
// membre courant et les trois actions ; toute la logique d'UI (bulles, emojis,
// GIF, saisie, scroll) vit ici. Cf. TransactionComments / AssetComments.
export default function CommentThread({ comments = [], members, myKey, onSend, onSendGif, onRemove, bare = false }) {
  const t = useTranslation();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [flying, setFlying] = useState(false);
  const listRef = useRef(null);

  const memberColorMap = buildMemberColorMap(members);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [comments.length]);

  async function send(content) {
    if (!content.trim() || busy) return;
    setBusy(true);
    setFlying(true);
    setTimeout(() => setFlying(false), 500);
    try {
      await onSend(content.trim());
      setText("");
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function sendGif(gifUrl) {
    if (busy) return;
    setBusy(true);
    try {
      await onSendGif(gifUrl);
      setShowGifPicker(false);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={
        bare
          ? {}
          : {
              background: "var(--bg-card)",
              borderRadius: "var(--radius-lg)",
              border: "0.5px solid var(--rule)",
              padding: "1rem 1.25rem",
              marginBottom: 12,
            }
      }
    >
      {!bare && (
        <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 8 }}>
          {t("tx_comments")} {comments.length > 0 && `(${comments.length})`}
        </p>
      )}

      {comments.length > 0 && (
        <div ref={listRef} style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
          {comments.map((c) => {
            const author = members.find((m) => getMemberKey(m) === c.memberId);
            const mine = c.memberId === myKey;
            const emojiOnly = isEmojiOnly(c.text);
            return (
              <div key={c.id} style={{ display: "flex", gap: 8, flexDirection: mine ? "row-reverse" : "row", alignItems: "flex-end" }}>
                {author && <Avatar member={author} colorMap={memberColorMap} size={22} />}
                <div style={{ maxWidth: "75%", display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
                  {c.gifUrl ? (
                    <img
                      src={c.gifUrl}
                      alt="GIF"
                      style={{ maxWidth: 180, borderRadius: "var(--radius-md)", border: "0.5px solid var(--rule)" }}
                    />
                  ) : emojiOnly ? (
                    <span style={{ fontSize: 28, lineHeight: 1.2 }}>{c.text}</span>
                  ) : (
                    <div
                      style={{
                        padding: "7px 11px",
                        borderRadius: mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                        background: mine ? "var(--sky-light)" : "var(--bg)",
                        border: "0.5px solid var(--rule)",
                        fontSize: 13,
                        whiteSpace: "pre-wrap",
                        overflowWrap: "break-word",
                      }}
                    >
                      {c.text}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
                    <span style={{ fontSize: 10, color: "var(--ink-3)" }}>
                      {new Date(c.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}{" "}
                      {new Date(c.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {mine && (
                      <button
                        onClick={() => onRemove(c.id)}
                        aria-label={t("tx_comment_delete")}
                        style={{ background: "none", border: "none", color: "var(--ink-3)", padding: 0, display: "flex" }}
                      >
                        <i className="ti ti-trash" style={{ fontSize: 11 }} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {QUICK_EMOJIS.map((e) => (
          <button
            key={e}
            onClick={() => send(e)}
            disabled={busy}
            aria-label={`${t("tx_comment_react")} ${e}`}
            style={{
              fontSize: 18,
              background: "var(--bg)",
              border: "0.5px solid var(--rule)",
              borderRadius: 99,
              width: 34,
              height: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            {e}
          </button>
        ))}
        {HAS_GIF_KEY && (
          <button
            onClick={() => setShowGifPicker(!showGifPicker)}
            aria-label="GIF"
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.05em",
              background: showGifPicker ? "var(--sky-light)" : "var(--bg)",
              color: showGifPicker ? "var(--sky)" : "var(--ink-2)",
              border: showGifPicker ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
              borderRadius: 99,
              width: 34,
              height: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            GIF
          </button>
        )}
      </div>

      {showGifPicker && (
        <Suspense fallback={<div className="skeleton" style={{ height: 90, marginBottom: 8, borderRadius: "var(--radius-md)" }} />}>
          <div style={{ marginBottom: 8 }}>
            <GifPicker onSelect={sendGif} onClose={() => setShowGifPicker(false)} />
          </div>
        </Suspense>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(text)}
          placeholder={t("tx_comment_placeholder")}
          style={{
            flex: 1,
            padding: "9px 12px",
            borderRadius: 99,
            border: "0.5px solid var(--rule)",
            background: "var(--bg)",
            fontSize: 13,
            outline: "none",
            color: "var(--ink)",
          }}
        />
        <button
          onClick={() => send(text)}
          disabled={!text.trim() || busy}
          aria-label={t("tx_comment_send")}
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "none",
            background: text.trim() ? "var(--sky)" : "var(--rule)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <i className={`ti ti-send${flying ? " pw-takeoff" : ""}`} style={{ fontSize: 15 }} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
