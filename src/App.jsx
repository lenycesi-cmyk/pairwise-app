import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { FinanceProvider } from "./context/FinanceContext";
import { useRecurringGenerator } from "./hooks/useRecurringGenerator";
import AuthScreen from "./screens/AuthScreen";
import CoupleSetupScreen from "./screens/CoupleSetupScreen";
import DashboardScreen from "./screens/DashboardScreen";
import TransactionsScreen from "./screens/TransactionsScreen";
import DebtScreen from "./screens/DebtScreen";
import CategoriesScreen from "./screens/CategoriesScreen";
import SettingsScreen from "./screens/SettingsScreen";
import AddTransactionScreen from "./screens/AddTransactionScreen";
import RecurringScreen from "./screens/RecurringScreen";
import BottomNav from "./components/BottomNav";

function RecurringGeneratorRunner() {
  useRecurringGenerator();
  return null;
}

function AppContent() {
  const { user, coupleId, loading } = useAuth();
  const [tab, setTab] = useState("dashboard");
  const [showAdd, setShowAdd] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [showRecurring, setShowRecurring] = useState(false);
  const [showCategories, setShowCategories] = useState(false);

  if (loading) {
    return (
      <div style={{ padding: "2rem 1.5rem" }}>
        <div className="skeleton" style={{ height: 40, width: 120, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 100, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  if (!user) return <AuthScreen />;
  if (!coupleId) return <CoupleSetupScreen />;

  function openEdit(tx) {
    setEditingTx(tx);
    setShowAdd(true);
  }

  function closeAdd() {
    setShowAdd(false);
    setEditingTx(null);
  }

  return (
    <FinanceProvider>
      <RecurringGeneratorRunner />

      {tab === "dashboard" && <DashboardScreen />}
      {tab === "transactions" && <TransactionsScreen onEdit={openEdit} />}
      {tab === "debt" && <DebtScreen />}
      {tab === "settings" && (
        <SettingsScreen
          onOpenRecurring={() => setShowRecurring(true)}
          onOpenCategories={() => setShowCategories(true)}
        />
      )}

      <BottomNav active={tab} onChange={setTab} onAddClick={() => setShowAdd(true)} />

      {showAdd && <AddTransactionScreen onClose={closeAdd} editingTx={editingTx} />}
      {showRecurring && <RecurringScreen onClose={() => setShowRecurring(false)} />}
      {showCategories && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--bg)",
            zIndex: 100,
            overflowY: "auto",
            maxWidth: 480,
            margin: "0 auto",
          }}
        >
          <div style={{ padding: "1.5rem 1.25rem" }}>
            <button
              onClick={() => setShowCategories(false)}
              aria-label="Fermer"
              style={{ background: "none", border: "none", marginBottom: 8 }}
            >
              <i className="ti ti-x" style={{ fontSize: 20 }} aria-hidden="true" />
            </button>
          </div>
          <CategoriesScreen />
        </div>
      )}
    </FinanceProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
