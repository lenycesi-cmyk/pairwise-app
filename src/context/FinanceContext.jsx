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
      }
    });

    return unsub;
  }, [coupleId]);

  async function addTransaction(tx) {
    if (!coupleId) return;
    await addDoc(collection(db, "couples", coupleId, "transactions"), {
      ...tx,
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
  }

  async function updateTransaction(id, updates) {
    if (!coupleId) return;
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
