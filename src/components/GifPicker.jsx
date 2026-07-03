import { useState, useEffect, useRef } from "react";
import { useTranslation } from "../hooks/useTranslation";

// Picker Tenor : on ne stocke jamais le fichier, seulement l'URL du GIF
// (tinygif ≈ 220px, léger). Nécessite VITE_TENOR_API_KEY (clé Google
// gratuite : https://developers.google.com/tenor) — sans clé, le bouton
// GIF n'apparaît pas du tout (voir TransactionComments).
const TENOR_KEY = import.meta.env.VITE_TENOR_API_KEY;

async function searchTenor(query, signal) {
  const endpoint = query
    ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}`
    : "https://tenor.googleapis.com/v2/featured?";
  const res = await fetch(
    `${endpoint}&key=${TENOR_KEY}&limit=12&media_filter=tinygif&contentfilter=medium`,
    { signal }
  );
  if (!res.ok) throw new Error(`Tenor ${res.status}`);
  const data = await res.json();
  return (data.results || [])
    .map((r) => r.media_formats?.tinygif?.url)
    .filter(Boolean);
}

export default function GifPicker({ onSelect, onClose }) {
  const t = useTranslation();
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(false);
      try {
        setGifs(await searchTenor(query, controller.signal));
      } catch (err) {
        if (err.name !== "AbortError") setError(true);
      } finally {
        setLoading(false);
      }
    }, query ? 350 : 0);
    return () => {
      controller.abort();
      clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div
      style={{
        marginTop: 8,
        border: "0.5px solid var(--rule)",
        borderRadius: "var(--radius-md)",
        background: "var(--bg)",
        padding: 10,
      }}
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          type="text"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("gif_search_placeholder")}
          style={{
            flex: 1,
            padding: "7px 10px",
            borderRadius: "var(--radius-sm)",
            border: "0.5px solid var(--rule)",
            background: "var(--bg-card)",
            fontSize: 13,
            outline: "none",
            color: "var(--ink)",
          }}
        />
        <button
          onClick={onClose}
          aria-label={t("gif_close")}
          style={{ background: "none", border: "none", color: "var(--ink-3)" }}
        >
          <i className="ti ti-x" style={{ fontSize: 16 }} aria-hidden="true" />
        </button>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 90, borderRadius: "var(--radius-sm)" }} />
      ) : error ? (
        <p style={{ fontSize: 12, color: "var(--ink-3)", textAlign: "center", padding: "1rem 0" }}>
          {t("gif_error")}
        </p>
      ) : gifs.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--ink-3)", textAlign: "center", padding: "1rem 0" }}>
          {t("gif_no_results")}
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 6,
            maxHeight: 240,
            overflowY: "auto",
          }}
        >
          {gifs.map((url) => (
            <button
              key={url}
              onClick={() => onSelect(url)}
              style={{ padding: 0, border: "none", background: "none", cursor: "pointer" }}
            >
              <img
                src={url}
                alt="GIF"
                loading="lazy"
                style={{
                  width: "100%",
                  height: 80,
                  objectFit: "cover",
                  borderRadius: "var(--radius-sm)",
                  border: "0.5px solid var(--rule)",
                  display: "block",
                }}
              />
            </button>
          ))}
        </div>
      )}
      <p style={{ fontSize: 9, color: "var(--ink-3)", textAlign: "right", marginTop: 6 }}>
        Via Tenor
      </p>
    </div>
  );
}
