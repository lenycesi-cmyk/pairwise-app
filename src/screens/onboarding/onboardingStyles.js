// Constantes de style partagées par les écrans d'onboarding (séparées des
// composants pour respecter react-refresh/only-export-components).

export const screenWrap = {
  minHeight: "100dvh",
  display: "flex",
  flexDirection: "column",
  width: "100%",
  // Colonne un peu plus étroite que le shell (480) : les cartes d'onboarding
  // paraissaient trop larges sur desktop.
  maxWidth: 430,
  margin: "0 auto",
  padding: "0",
};

export const scrollArea = {
  flex: 1,
  overflowY: "auto",
  padding: "24px 22px 28px",
  display: "flex",
  flexDirection: "column",
};

export const primaryBtn = {
  width: "100%",
  border: "none",
  background: "var(--tang)",
  color: "#fff",
  borderRadius: "var(--radius-md)",
  padding: 15,
  fontFamily: "inherit",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  boxShadow: "var(--shadow)",
};

export const ghostBtn = {
  width: "100%",
  border: "0.5px solid var(--rule)",
  background: "transparent",
  color: "var(--ink-3)",
  borderRadius: "var(--radius-md)",
  padding: 12,
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
};

export const displayTitle = {
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 27,
  lineHeight: 1.1,
  letterSpacing: "-0.01em",
  margin: "0 0 12px",
};
