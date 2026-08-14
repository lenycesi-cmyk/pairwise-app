import { useState } from "react";
import { useTranslation } from "../hooks/useTranslation";

// Section « Archivés » repliée, partagée par Budget et Objectifs.
//
// Elle vit EN BAS DE L'ÉCRAN D'ORIGINE plutôt que dans un écran d'historique
// central : l'élément archivé n'a pas bougé, donc son détail se rend avec le
// code de l'écran (mêmes barres de progression, même devise d'affichage, même
// calcul de période). Un écran central aurait dû en tenir une seconde
// implémentation, qui aurait divergé.
//
// Repliée par défaut : une archive ne se consulte pas tous les jours, et
// déployée elle pousserait le contenu vivant hors de l'écran.
export default function ArchivedSection({ items, onRestore, onDelete, emptyHint }) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState(null);

  if (!items || items.length === 0) return null;

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "0.5px solid var(--rule)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        marginTop: 14,
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 9,
          padding: "12px 16px", background: "none", border: "none",
          font: "inherit", fontSize: 13, fontWeight: 700,
          color: "var(--ink-2)", cursor: "pointer", textAlign: "left",
        }}
      >
        <i
          className={open ? "ti ti-chevron-down" : "ti ti-chevron-right"}
          style={{ fontSize: 14, color: "var(--ink-3)" }}
          aria-hidden="true"
        />
        {t("archived_section_title")}
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--ink-3)" }}>
          {items.length}
        </span>
      </button>

      {open && (
        <>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex", alignItems: "center", gap: 11,
                padding: "11px 16px", borderTop: "0.5px solid var(--rule)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-2)" }}>
                  {item.title}
                </div>
                {item.meta && (
                  <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>
                    {item.meta}
                  </div>
                )}
              </div>

              {confirmId === item.id ? (
                <>
                  <button
                    onClick={() => { onDelete(item.id); setConfirmId(null); }}
                    style={{ background: "none", border: "none", font: "inherit", fontSize: 12.5, fontWeight: 700, color: "var(--over)", cursor: "pointer" }}
                  >
                    {t("archived_confirm_delete")}
                  </button>
                  <button
                    onClick={() => setConfirmId(null)}
                    style={{ background: "none", border: "none", font: "inherit", fontSize: 12.5, color: "var(--ink-3)", cursor: "pointer" }}
                  >
                    {t("archived_cancel")}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => onRestore(item.id)}
                    aria-label={t("archived_restore")}
                    title={t("archived_restore")}
                    style={{ background: "none", border: "none", color: "var(--tang)", cursor: "pointer", padding: 4, lineHeight: 1 }}
                  >
                    <i className="ti ti-arrow-back-up" style={{ fontSize: 16 }} aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => setConfirmId(item.id)}
                    aria-label={t("archived_delete")}
                    title={t("archived_delete")}
                    style={{ background: "none", border: "none", color: "var(--ink-3)", cursor: "pointer", padding: 4, lineHeight: 1 }}
                  >
                    <i className="ti ti-trash" style={{ fontSize: 15 }} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          ))}
          {emptyHint && (
            <p style={{ fontSize: 11.5, color: "var(--ink-3)", margin: 0, padding: "0 16px 14px" }}>
              {emptyHint}
            </p>
          )}
        </>
      )}
    </div>
  );
}
