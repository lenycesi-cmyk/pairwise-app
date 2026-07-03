import { useState, useEffect, useRef } from "react";
import { useTranslation } from "../hooks/useTranslation";

// Picker GIPHY : on ne stocke jamais le fichier, seulement l'URL du GIF
// (fixed_height_small ≈ 100px de haut, léger). Nécessite VITE_GIPHY_API_KEY
// (clé gratuite : https://developers.giphy.com) — sans clé, le bouton GIF
// n'apparaît pas du tout (voir TransactionComments).
const GIPHY_KEY = import.meta.env.VITE_GIPHY_API_KEY;

async function searchGiphy(query, signal) {
  const endpoint = query
    ? `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(query)}&`
    : "https://api.giphy.com/v1/gifs/trending?";
  const res = await fetch(
    `${endpoint}api_key=${GIPHY_KEY}&limit=12&rating=pg-13`,
    { signal }
  );
  if (!res.ok) throw new Error(`GIPHY ${res.status}`);
  const data = await res.json();
  return (data.data || [])
    .map((g) => g.images?.fixed_height_small?.url)
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
        setGifs(await searchGiphy(query, controller.signal));
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
      {/* Attribution requise par les conditions d'utilisation de GIPHY */}
      <p style={{ fontSize: 9, color: "var(--ink-3)", textAlign: "right", marginTop: 6 }}>
        Powered by GIPHY
      </p>
    </div>
  );
}
