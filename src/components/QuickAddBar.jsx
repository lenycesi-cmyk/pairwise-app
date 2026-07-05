import { useState, useRef, useEffect } from "react";
import { useTranslation } from "../hooks/useTranslation";

// Barre de saisie rapide en langage naturel : l'utilisateur tape (ou dicte)
// "15€ resto hier" et le formulaire se pré-remplit. La dictée vocale utilise
// l'API SpeechRecognition du navigateur quand elle est disponible (Chrome,
// certains Safari) ; le bouton micro est masqué sinon — le clavier natif
// reste toujours dictable dans le champ texte.
export default function QuickAddBar({ language, onApply }) {
  const t = useTranslation();
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const SpeechRecognition =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // recognition déjà arrêtée
      }
    };
  }, []);

  function apply(value) {
    const v = (value ?? text).trim();
    if (!v) return;
    onApply(v);
    setText("");
  }

  function toggleVoice() {
    if (!SpeechRecognition) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = language === "en" ? "en-US" : "fr-FR";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setText(transcript);
      apply(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--lavi-light)",
          border: "0.5px solid var(--lavi)",
          borderRadius: "var(--radius-lg)",
          padding: "8px 12px",
        }}
      >
        <i className="ti ti-sparkles" style={{ fontSize: 16, color: "var(--lavi)", flexShrink: 0 }} aria-hidden="true" />
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && apply()}
          placeholder={t("tx_quickadd_placeholder")}
          style={{
            flex: 1, minWidth: 0, border: "none", outline: "none",
            background: "transparent", fontSize: 14, color: "var(--ink)",
          }}
        />
        {SpeechRecognition && (
          <button
            type="button"
            onClick={toggleVoice}
            aria-label={t("tx_quickadd_voice")}
            style={{
              background: listening ? "var(--lavi)" : "transparent",
              border: "none", borderRadius: "50%", width: 30, height: 30,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: listening ? "#fff" : "var(--lavi)", flexShrink: 0,
            }}
          >
            <i className={`ti ${listening ? "ti-microphone-2" : "ti-microphone"}`} style={{ fontSize: 16 }} aria-hidden="true" />
          </button>
        )}
        {text.trim() && (
          <button
            type="button"
            onClick={() => apply()}
            style={{
              background: "var(--lavi)", color: "#fff", border: "none",
              borderRadius: "var(--radius-md)", padding: "5px 12px",
              fontSize: 13, fontWeight: 500, flexShrink: 0,
            }}
          >
            {t("tx_quickadd_apply")}
          </button>
        )}
      </div>
      <p style={{ fontSize: 11, color: "var(--ink-3)", margin: "5px 4px 0" }}>
        {t("tx_quickadd_hint")}
      </p>
    </div>
  );
}
