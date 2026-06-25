import { useFinance } from "../context/FinanceContext";
import { translate } from "../data/translations";

export function useTranslation() {
  const { language } = useFinance();
  return function t(key) {
    return translate(language || "fr", key);
  };
}
