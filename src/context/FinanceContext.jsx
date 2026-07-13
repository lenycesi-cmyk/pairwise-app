import { createContext, useContext, useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  orderBy,
  arrayUnion,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { applyTheme } from "../data/themes";
import { useAuth } from "./AuthContext";
import { ALL_CATEGORIES } from "../data/categories";
import { getExchangeRate } from "../utils/currencyConversion";
import { sendPushNotification } from "../utils/sendPush";
import { dedupeTags } from "../utils/tags";

const FinanceContext = createContext(null);

export function FinanceProvider({ children }) {
  const { coupleId, user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState(ALL_CATEGORIES);
  const [members, setMembers] = useState([]);
  const [coupleName, setCoupleName] = useState("");
  const [loading, setLoading] = useState(true);
  const [defaultCurrency, setDefaultCurrency] = useState("EUR");
  const [currencyMode, setCurrencyMode] = useState("fixed");
  // "shared" (défaut, historique) : chacun ses finances, on suit qui doit quoi
  // (split + debt tracker). "common" : compte commun, pas de dette entre
  // partenaires — on garde le suivi "qui dépense quoi et pour qui".
  const [financeMode, setFinanceMode] = useState("shared");
  // Devises proposées dans les sélecteurs (ajout de transaction...). null =
  // toutes les devises (défaut) ; sinon la liste blanche choisie par le couple.
  const [enabledCurrencies, setEnabledCurrencies] = useState(null);
  const [lastUsedCurrency, setLastUsedCurrency] = useState("EUR");
  const [recurringTx, setRecurringTx] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [goals, setGoals] = useState([]);
  const [budgetHistory, setBudgetHistory] = useState({});
  const [incomeAccountLinks, setIncomeAccountLinksState] = useState({});
  const [assets, setAssets] = useState([]);
  const [netWorthHistory, setNetWorthHistory] = useState([]);
  const [wealthDisplayCurrency, setWealthDisplayCurrency] = useState(null);
  const [dashboardDisplayCurrency, setDashboardDisplayCurrency] = useState(null);
  const [budgetDisplayCurrency, setBudgetDisplayCurrency] = useState(null);
  const [theme, setThemeState] = useState("pairwise");
  const [language, setLanguageState] = useState("fr");
  const [debtSettlements, setDebtSettlements] = useState([]);
  const [pushPrefs, setPushPrefs] = useState({});
  // Liste de tags personnalisée du couple (ordonnée). Vide tant que non
  // personnalisée : les suggestions retombent alors sur les presets + historique.
  const [customTags, setCustomTags] = useState([]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!coupleId) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, "couples", coupleId, "transactions"),
      orderBy("date", "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTransactions(txs);
      setLoading(false);
    });

    return unsub;
  }, [coupleId]);

  // Dernière devise utilisée, propre à l'utilisateur (mode "last"). Suivie en
  // temps réel pour rester cohérente entre les appareils du même utilisateur.
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists() && snap.data().lastUsedCurrency) {
        setLastUsedCurrency(snap.data().lastUsedCurrency);
      }
    });
    return unsub;
  }, [user?.uid]);

  useEffect(() => {
    if (!coupleId) return;

    const unsub = onSnapshot(doc(db, "couples", coupleId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.categories) setCategories(data.categories);
        if (data.defaultCurrency) setDefaultCurrency(data.defaultCurrency);
        if (data.members) setMembers(data.members);
        if (data.coupleName !== undefined) setCoupleName(data.coupleName);
        if (data.currencyMode) setCurrencyMode(data.currencyMode);
        if (data.financeMode) setFinanceMode(data.financeMode);
        if (Array.isArray(data.enabledCurrencies)) setEnabledCurrencies(data.enabledCurrencies);
        // lastUsedCurrency est désormais PAR UTILISATEUR (users/{uid}) et non
        // plus au niveau du couple : deux partenaires dans des pays différents
        // gardent chacun leur dernière devise. Chargé dans l'effet dédié.
        if (data.recurringTx) setRecurringTx(data.recurringTx);
        if (data.budgets) setBudgets(data.budgets);
        if (data.goals) setGoals(data.goals);
        if (data.budgetHistory) setBudgetHistory(data.budgetHistory);
        if (data.incomeAccountLinks) setIncomeAccountLinksState(data.incomeAccountLinks);
        if (data.assets) setAssets(data.assets);
        if (data.netWorthHistory) setNetWorthHistory(data.netWorthHistory);
        if (data.wealthDisplayCurrency) setWealthDisplayCurrency(data.wealthDisplayCurrency);
        if (data.dashboardDisplayCurrency) setDashboardDisplayCurrency(data.dashboardDisplayCurrency);
        if (data.budgetDisplayCurrency) setBudgetDisplayCurrency(data.budgetDisplayCurrency);
        if (data.theme) setThemeState(data.theme);
        if (data.language) setLanguageState(data.language);
        if (data.debtSettlements) setDebtSettlements(data.debtSettlements);
        if (data.pushPrefs) setPushPrefs(data.pushPrefs);
        if (data.customTags) setCustomTags(data.customTags);
      }
    });

    return unsub;
  }, [coupleId]);

  async function addTransaction(tx) {
    if (!coupleId) return;

    // Conversion figée au moment de la création (pas de recalcul dynamique ensuite)
    const { rate, isFallback } = await getExchangeRate(tx.currency, defaultCurrency);
    const convertedAmount = tx.amount * rate;

    const docRef = await addDoc(collection(db, "couples", coupleId, "transactions"), {
      ...tx,
      convertedAmount,
      convertedCurrency: defaultCurrency,
      exchangeRate: rate,
      exchangeRateIsFallback: isFallback,
      memberUids: members.map((m) => m.uid),
      createdAt: Date.now(),
      createdBy: user.uid,
    });
    // Mémorise la dernière devise utilisée (pour le mode "last") — PAR
    // UTILISATEUR : chacun garde sa propre dernière devise.
    if (tx.currency && tx.currency !== lastUsedCurrency && user?.uid) {
      await setDoc(
        doc(db, "users", user.uid),
        { lastUsedCurrency: tx.currency },
        { merge: true }
      );
    }

    // Si la sous-catégorie de revenu est liée à un compte du Patrimoine, on crédite ce compte
    if (tx.type === "income" && tx.subcategory) {
      const linkedAssetId = incomeAccountLinks[tx.subcategory];
      const linkedAsset = linkedAssetId && assets.find((a) => a.id === linkedAssetId);
      if (linkedAsset) {
        const { rate } = await getExchangeRate(tx.currency, linkedAsset.currency);
        await updateAsset(linkedAssetId, { value: linkedAsset.value + tx.amount * rate });
      }
    }

    // Push au partenaire (fire-and-forget, selon ses préférences)
    if (members.length > 1) {
      sendPushNotification({
        coupleId,
        kind: "newTransaction",
        description: tx.description || "",
        amount: tx.amount,
        currency: tx.currency,
      });
    }

    return docRef.id;
  }

  async function updateTransaction(id, updates) {
    if (!coupleId) return;

    // Si le montant ou la devise change, on refige la conversion
    if (updates.amount !== undefined || updates.currency !== undefined) {
      const existing = transactions.find((t) => t.id === id);
      const amount = updates.amount !== undefined ? updates.amount : existing?.amount;
      const currency = updates.currency !== undefined ? updates.currency : existing?.currency;

      const { rate, isFallback } = await getExchangeRate(currency, defaultCurrency);
      updates = {
        ...updates,
        convertedAmount: amount * rate,
        convertedCurrency: defaultCurrency,
        exchangeRate: rate,
        exchangeRateIsFallback: isFallback,
      };
    }

    await updateDoc(doc(db, "couples", coupleId, "transactions", id), {
      ...updates,
      updatedBy: user.uid,
    });

    // Push "transaction modifiée" seulement pour un changement de fond —
    // pas pour l'upload d'un reçu ou une écriture système.
    const MEANINGFUL = ["amount", "currency", "description", "categoryId", "subcategory", "date", "paidBy", "split", "splitDetails", "type"];
    if (members.length > 1 && MEANINGFUL.some((f) => updates[f] !== undefined)) {
      const existing = transactions.find((t) => t.id === id);
      sendPushNotification({
        coupleId,
        kind: "editedTransaction",
        description: updates.description ?? existing?.description ?? "",
        amount: updates.amount ?? existing?.amount,
        currency: updates.currency ?? existing?.currency,
      });
    }
  }

  // Fil de discussion sur une transaction : chaque entrée est
  // { id, memberId, text? | gifUrl?, createdAt }. arrayUnion évite les
  // écrasements si les deux membres commentent en même temps.
  async function addTransactionComment(txId, comment) {
    if (!coupleId) return;
    await updateDoc(doc(db, "couples", coupleId, "transactions", txId), {
      comments: arrayUnion({
        id: `comment_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        createdAt: Date.now(),
        ...comment,
      }),
    });

    if (members.length > 1) {
      const tx = transactions.find((t) => t.id === txId);
      sendPushNotification({
        coupleId,
        kind: "comment",
        description: tx?.description || "",
        text: comment.text || "",
        gifUrl: comment.gifUrl || "",
      });
    }
  }

  // Préférences push d'UN membre (fusionnées champ par champ) :
  // pushPrefs.{memberKey} = { newTransaction, editedTransaction, comments,
  // recurringReminders } — tout est considéré actif sauf false explicite.
  async function updateMemberPushPrefs(memberKey, prefs) {
    if (!coupleId) return;
    await setDoc(
      doc(db, "couples", coupleId),
      { pushPrefs: { [memberKey]: prefs } },
      { merge: true }
    );
  }

  async function removeTransactionComment(txId, commentId) {
    if (!coupleId) return;
    const tx = transactions.find((t) => t.id === txId);
    if (!tx?.comments) return;
    await updateDoc(doc(db, "couples", coupleId, "transactions", txId), {
      comments: tx.comments.filter((c) => c.id !== commentId),
    });
  }

  async function deleteTransaction(id) {
    if (!coupleId) return;
    await deleteDoc(doc(db, "couples", coupleId, "transactions", id));
  }

  async function updateCategories(newCategories) {
    if (!coupleId) return;
    await setDoc(
      doc(db, "couples", coupleId),
      { categories: newCategories },
      { merge: true }
    );
  }

  async function updateCustomTags(tags) {
    if (!coupleId) return;
    setCustomTags(tags); // maj optimiste (le champ n'est pas re-fusionné ailleurs)
    await setDoc(
      doc(db, "couples", coupleId),
      { customTags: tags },
      { merge: true }
    );
  }

  // Renomme un tag partout : dans les transactions qui le portent (pour que
  // les chips et le report par tag restent cohérents) via un batch d'écritures.
  // La liste customTags elle-même est mise à jour côté appelant (TagManager),
  // qui connaît la matérialisation des presets.
  async function replaceTagInTransactions(oldTag, newTag) {
    if (!coupleId || !newTag || oldTag === newTag) return;
    const affected = transactions.filter((t) => (t.tags || []).includes(oldTag));
    if (!affected.length) return;
    const batch = writeBatch(db);
    for (const tx of affected) {
      const nextTags = dedupeTags(
        (tx.tags || []).map((x) => (x === oldTag ? newTag : x))
      );
      batch.update(doc(db, "couples", coupleId, "transactions", tx.id), {
        tags: nextTags,
      });
    }
    await batch.commit();
  }

  async function updateDefaultCurrency(currency) {
    if (!coupleId) return;
    await setDoc(
      doc(db, "couples", coupleId),
      { defaultCurrency: currency },
      { merge: true }
    );
  }

  async function updateCurrencyMode(mode) {
    if (!coupleId) return;
    await setDoc(
      doc(db, "couples", coupleId),
      { currencyMode: mode },
      { merge: true }
    );
  }

  async function updateFinanceMode(mode) {
    if (!coupleId) return;
    setFinanceMode(mode); // optimiste
    await setDoc(doc(db, "couples", coupleId), { financeMode: mode }, { merge: true });
  }

  async function updateEnabledCurrencies(codes) {
    setEnabledCurrencies(codes);
    if (!coupleId) return;
    await setDoc(
      doc(db, "couples", coupleId),
      { enabledCurrencies: codes },
      { merge: true }
    );
  }

  // Records that shared expenses were settled up as of `date` — "mark as
  // paid" in the debt tracker. Doesn't touch any transaction; the debt
  // hook just ignores every shared expense dated before the latest
  // settlement when computing the running "total" balance, so the debt
  // effectively resets to 0 going forward without rewriting history.
  // settledInfo ({ amount, currency }) sert uniquement au push "dette
  // réglée" envoyé au partenaire — le montant n'est pas stocké (le solde se
  // recalcule toujours depuis les transactions).
  async function addDebtSettlement(date, note = "", settledInfo = null) {
    if (!coupleId) return;
    const updated = [
      ...debtSettlements,
      { id: `settle_${Date.now()}`, date, note, createdAt: Date.now(), createdBy: user.uid },
    ];
    await setDoc(doc(db, "couples", coupleId), { debtSettlements: updated }, { merge: true });

    if (members.length > 1) {
      sendPushNotification({
        coupleId,
        kind: "debtSettled",
        description: note || "",
        amount: settledInfo?.amount,
        currency: settledInfo?.currency,
      });
    }
  }

  async function addRecurring(rule) {
    if (!coupleId) return;
    const updated = [...recurringTx, { ...rule, id: `rec_${Date.now()}` }];
    await setDoc(doc(db, "couples", coupleId), { recurringTx: updated }, { merge: true });
  }

  async function updateRecurring(id, updates) {
    if (!coupleId) return;
    const updated = recurringTx.map((r) => (r.id === id ? { ...r, ...updates } : r));
    await setDoc(doc(db, "couples", coupleId), { recurringTx: updated }, { merge: true });
  }

  async function removeRecurring(id) {
    if (!coupleId) return;
    const updated = recurringTx.filter((r) => r.id !== id);
    await setDoc(doc(db, "couples", coupleId), { recurringTx: updated }, { merge: true });
  }

  async function addBudget(budget) {
    if (!coupleId) return;
    const newBudget = {
      ...budget,
      id: `budget_${Date.now()}`,
      active: budget.active ?? true,
      createdAt: Date.now(),
    };
    const updated = [...budgets, newBudget];
    await setDoc(doc(db, "couples", coupleId), { budgets: updated }, { merge: true });

    if (members.length > 1) {
      sendPushNotification({
        coupleId,
        kind: "newBudget",
        description: newBudget.name || t_budgetLabel(newBudget),
        amount: newBudget.amount,
        currency: newBudget.currency,
      });
    }
  }

  // Libellé lisible d'un budget sans nom : global, ou noms des catégories.
  function t_budgetLabel(budget) {
    if (budget.scope === "global") return "Budget global";
    return (budget.categoryIds || [])
      .map((cid) => categories.find((c) => c.id === cid)?.name)
      .filter(Boolean)
      .join(", ") || "Budget";
  }

  async function updateBudget(id, updates) {
    if (!coupleId) return;
    const updated = budgets.map((b) => (b.id === id ? { ...b, ...updates } : b));
    await setDoc(doc(db, "couples", coupleId), { budgets: updated }, { merge: true });
  }

  async function removeBudget(id) {
    if (!coupleId) return;
    const updated = budgets.filter((b) => b.id !== id);
    await setDoc(doc(db, "couples", coupleId), { budgets: updated }, { merge: true });
  }

  // Objectifs d'épargne / patrimoine — même pattern read-modify-merge que les
  // budgets. La progression est calculée à la lecture (assets liés) par
  // useGoalProgress, jamais stockée ici.
  async function addGoal(goal) {
    if (!coupleId) return;
    const newGoal = {
      ...goal,
      id: `goal_${Date.now()}`,
      ownership: goal.ownership || "shared",
      createdAt: Date.now(),
    };
    const updated = [...goals, newGoal];
    await setDoc(doc(db, "couples", coupleId), { goals: updated }, { merge: true });
  }

  async function updateGoal(id, updates) {
    if (!coupleId) return;
    const updated = goals.map((g) => (g.id === id ? { ...g, ...updates } : g));
    await setDoc(doc(db, "couples", coupleId), { goals: updated }, { merge: true });
  }

  async function removeGoal(id) {
    if (!coupleId) return;
    const updated = goals.filter((g) => g.id !== id);
    await setDoc(doc(db, "couples", coupleId), { goals: updated }, { merge: true });
  }

  // Réordonne l'ensemble des budgets (drag & drop dans l'onglet Budget). L'ordre
  // du tableau pilote aussi les 3 budgets affichés dans le widget d'Accueil.
  async function reorderBudgets(orderedBudgets) {
    if (!coupleId) return;
    setBudgets(orderedBudgets); // optimiste
    await setDoc(doc(db, "couples", coupleId), { budgets: orderedBudgets }, { merge: true });
  }

  // Enregistre un lot de snapshots d'historique de budget (clôtures de période).
  // entries: [{ budgetId, key, data }]. Read-modify-merge de l'objet complet
  // pour ne jamais écraser les autres budgets/périodes déjà stockés.
  async function saveBudgetSnapshots(entries) {
    if (!coupleId || !entries || entries.length === 0) return;
    const next = { ...budgetHistory };
    for (const { budgetId, key, data } of entries) {
      next[budgetId] = { ...(next[budgetId] || {}), [key]: data };
    }
    setBudgetHistory(next); // optimiste
    await setDoc(doc(db, "couples", coupleId), { budgetHistory: next }, { merge: true });
  }

  async function setIncomeAccountLinks(map) {
    if (!coupleId) return;
    await setDoc(doc(db, "couples", coupleId), { incomeAccountLinks: map }, { merge: true });
  }

  async function addAsset(asset) {
    if (!coupleId) return;
    const newAsset = {
      ...asset,
      id: `asset_${Date.now()}`,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
    };
    const updated = [...assets, newAsset];
    await setDoc(doc(db, "couples", coupleId), { assets: updated }, { merge: true });

    if (members.length > 1) {
      sendPushNotification({
        coupleId,
        kind: "newAsset",
        description: newAsset.name || "",
        amount: newAsset.value,
        currency: newAsset.currency,
      });
    }
  }

  async function updateAsset(id, updates) {
    if (!coupleId) return;
    const updated = assets.map((a) =>
      a.id === id ? { ...a, ...updates, lastUpdated: Date.now() } : a
    );
    await setDoc(doc(db, "couples", coupleId), { assets: updated }, { merge: true });
  }

  async function removeAsset(id) {
    if (!coupleId) return;
    const updated = assets.filter((a) => a.id !== id);
    await setDoc(doc(db, "couples", coupleId), { assets: updated }, { merge: true });
  }

  async function recordNetWorthSnapshot(totalValue, currency) {
    if (!coupleId) return;
    const today = new Date().toISOString().slice(0, 10);
    // Un seul point par jour : on remplace s'il existe déjà pour aujourd'hui
    const filtered = netWorthHistory.filter((h) => h.date !== today);
    const updated = [...filtered, { date: today, value: totalValue, currency }].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );
    await setDoc(
      doc(db, "couples", coupleId),
      { netWorthHistory: updated },
      { merge: true }
    );
  }

  async function updateMemberPhoto(uid, photoURL) {
    if (!coupleId) return;
    const updatedMembers = members.map((m) =>
      m.uid === uid ? { ...m, photoURL } : m
    );
    await setDoc(
      doc(db, "couples", coupleId),
      { members: updatedMembers, memberUids: updatedMembers.map((m) => m.uid) },
      { merge: true }
    );
  }

  async function updateMemberName(uid, name) {
    if (!coupleId) return;
    const updatedMembers = members.map((m) =>
      m.uid === uid ? { ...m, name } : m
    );
    await setDoc(
      doc(db, "couples", coupleId),
      { members: updatedMembers },
      { merge: true }
    );
  }

  async function updateCoupleName(name) {
    if (!coupleId) return;
    await setDoc(doc(db, "couples", coupleId), { coupleName: name }, { merge: true });
  }

  async function updateMemberAvatarColor(uid, avatarColor) {
    if (!coupleId) return;
    const updatedMembers = members.map((m) =>
      m.uid === uid ? { ...m, avatarColor } : m
    );
    await setDoc(
      doc(db, "couples", coupleId),
      { members: updatedMembers },
      { merge: true }
    );
  }

  async function updateWealthDisplayCurrency(currency) {
    if (!coupleId) return;
    await setDoc(
      doc(db, "couples", coupleId),
      { wealthDisplayCurrency: currency },
      { merge: true }
    );
  }

  async function updateDashboardDisplayCurrency(currency) {
    if (!coupleId) return;
    await setDoc(
      doc(db, "couples", coupleId),
      { dashboardDisplayCurrency: currency },
      { merge: true }
    );
  }

  async function updateBudgetDisplayCurrency(currency) {
    if (!coupleId) return;
    await setDoc(
      doc(db, "couples", coupleId),
      { budgetDisplayCurrency: currency },
      { merge: true }
    );
  }

  async function updateTheme(themeKey) {
    setThemeState(themeKey);
    if (coupleId) {
      await setDoc(doc(db, "couples", coupleId), { theme: themeKey }, { merge: true });
    }
  }

  async function updateLanguage(lang) {
    setLanguageState(lang);
    if (coupleId) {
      await setDoc(doc(db, "couples", coupleId), { language: lang }, { merge: true });
    }
  }

  const value = {
    transactions,
    categories,
    members,
    coupleName,
    updateCoupleName,
    loading,
    defaultCurrency,
    currencyMode,
    financeMode,
    updateFinanceMode,
    enabledCurrencies,
    updateEnabledCurrencies,
    lastUsedCurrency,
    recurringTx,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addTransactionComment,
    removeTransactionComment,
    pushPrefs,
    updateMemberPushPrefs,
    updateCategories,
    customTags,
    updateCustomTags,
    replaceTagInTransactions,
    updateDefaultCurrency,
    updateCurrencyMode,
    addRecurring,
    updateRecurring,
    removeRecurring,
    budgets,
    addBudget,
    updateBudget,
    removeBudget,
    reorderBudgets,
    budgetHistory,
    saveBudgetSnapshots,
    goals,
    addGoal,
    updateGoal,
    removeGoal,
    incomeAccountLinks,
    setIncomeAccountLinks,
    assets,
    addAsset,
    updateAsset,
    removeAsset,
    netWorthHistory,
    recordNetWorthSnapshot,
    updateMemberPhoto,
    updateMemberName,
    updateMemberAvatarColor,
    wealthDisplayCurrency,
    updateWealthDisplayCurrency,
    dashboardDisplayCurrency,
    updateDashboardDisplayCurrency,
    budgetDisplayCurrency,
    updateBudgetDisplayCurrency,
    theme,
    updateTheme,
    language,
    updateLanguage,
    debtSettlements,
    addDebtSettlement,
  };

  return (
    <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider");
  return ctx;
}
