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
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";
import { ALL_CATEGORIES } from "../data/categories";
import { getExchangeRate } from "../utils/currencyConversion";

const FinanceContext = createContext(null);

export function FinanceProvider({ children }) {
  const { coupleId, user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState(ALL_CATEGORIES);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [defaultCurrency, setDefaultCurrency] = useState("EUR");
  const [currencyMode, setCurrencyMode] = useState("fixed");
  const [lastUsedCurrency, setLastUsedCurrency] = useState("EUR");
  const [recurringTx, setRecurringTx] = useState([]);
  const [assets, setAssets] = useState([]);
  const [netWorthHistory, setNetWorthHistory] = useState([]);
  const [wealthDisplayCurrency, setWealthDisplayCurrency] = useState(null);

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

  useEffect(() => {
    if (!coupleId) return;

    const unsub = onSnapshot(doc(db, "couples", coupleId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.categories) setCategories(data.categories);
        if (data.defaultCurrency) setDefaultCurrency(data.defaultCurrency);
        if (data.members) setMembers(data.members);
        if (data.currencyMode) setCurrencyMode(data.currencyMode);
        if (data.lastUsedCurrency) setLastUsedCurrency(data.lastUsedCurrency);
        if (data.recurringTx) setRecurringTx(data.recurringTx);
        if (data.assets) setAssets(data.assets);
        if (data.netWorthHistory) setNetWorthHistory(data.netWorthHistory);
        if (data.wealthDisplayCurrency) setWealthDisplayCurrency(data.wealthDisplayCurrency);
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
    // Mémorise la dernière devise utilisée (pour le mode "last")
    if (tx.currency && tx.currency !== lastUsedCurrency) {
      await setDoc(
        doc(db, "couples", coupleId),
        { lastUsedCurrency: tx.currency },
        { merge: true }
      );
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

    await updateDoc(doc(db, "couples", coupleId, "transactions", id), updates);
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

  const value = {
    transactions,
    categories,
    members,
    loading,
    defaultCurrency,
    currencyMode,
    lastUsedCurrency,
    recurringTx,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    updateCategories,
    updateDefaultCurrency,
    updateCurrencyMode,
    addRecurring,
    updateRecurring,
    removeRecurring,
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
