// Déclencheur du moment de "délice" (confettis + checkmark). Séparé du
// composant Celebration.jsx pour que ce dernier n'exporte que des composants
// (react-refresh). Appelable de n'importe où :
//   celebrate("Objectif atteint 🎉")
export function celebrate(label) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("pw-celebrate", { detail: { label } }));
}
