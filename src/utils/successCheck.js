// Déclencheur du checkmark de validation (ajout de transaction, d'actif…).
// Séparé du composant SuccessCheck.jsx pour que ce dernier n'exporte que des
// composants (react-refresh). Appelable de n'importe où : notifySuccess().
export function notifySuccess() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("pw-success"));
}
