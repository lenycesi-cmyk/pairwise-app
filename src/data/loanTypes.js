// Catégories de crédit proposées à la création d'un prêt. `color` référence un
// accent du design system (tang/sky/lavi/sage/amber/pink). Les libellés sont
// résolus via t(`loan_type_${id}`) dans data/translations.js.
export const LOAN_TYPES = [
  { id: "mortgage", icon: "ti-home", color: "tang" },
  { id: "car", icon: "ti-car", color: "sky" },
  { id: "consumer", icon: "ti-shopping-bag", color: "lavi" },
  { id: "student", icon: "ti-school", color: "sage" },
  { id: "personal", icon: "ti-cash", color: "amber" },
  { id: "other", icon: "ti-file-invoice", color: "mint" },
];

export function loanType(id) {
  return LOAN_TYPES.find((t) => t.id === id) || LOAN_TYPES[LOAN_TYPES.length - 1];
}
