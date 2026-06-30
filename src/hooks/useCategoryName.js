import { useFinance } from "../context/FinanceContext";
import { getCategoryName, getSubcategoryName } from "../data/categories";

export function useCategoryName() {
  const { language } = useFinance();
  return {
    catName: (cat) => getCategoryName(cat, language),
    subName: (subName, catId) => getSubcategoryName(subName, catId, language),
  };
}
