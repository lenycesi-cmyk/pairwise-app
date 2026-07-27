import { useState } from "react";
import CurrencyPicker from "./CurrencyPicker";

// Sélecteur de devise compact pour les formulaires (actifs, versements) :
// une puce qui ouvre le CurrencyPicker partagé (même liste, gestion et recherche
// « Ajouter une devise » que le reste de l'app). `suffix` ajoute un libellé après
// le code (ex. « / u. » pour un prix unitaire).
export default function CurrencyField({ value, onChange, suffix }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "6px 10px", borderRadius: 99,
          border: "0.5px solid var(--rule)", background: "var(--bg-card)",
          fontSize: 13, fontWeight: 600, color: "var(--ink)", cursor: "pointer", whiteSpace: "nowrap",
        }}
      >
        {value}{suffix ? ` ${suffix}` : ""}
        <i className={`ti ${open ? "ti-chevron-up" : "ti-chevron-down"}`} style={{ fontSize: 14, color: "var(--ink-3)" }} aria-hidden="true" />
      </button>
      {open && (
        <>
          {/* Fond invisible : un clic à l'extérieur referme le panneau. */}
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 39 }} />
          <div
            style={{
              position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 40,
              width: 280, maxWidth: "78vw", maxHeight: 320, overflowY: "auto",
              background: "var(--bg-card)", border: "0.5px solid var(--rule)",
              borderRadius: "var(--radius-md)", padding: "10px 12px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            }}
          >
            <CurrencyPicker value={value} onSelect={(code) => { onChange(code); setOpen(false); }} />
          </div>
        </>
      )}
    </div>
  );
}
