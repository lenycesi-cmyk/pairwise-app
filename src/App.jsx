import { useState, lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { FinanceProvider } from "./context/FinanceContext";
import { useRecurringGenerator } from "./hooks/useRecurringGenerator";
import AuthScreen from "./screens/AuthScreen";
import CoupleSetupScreen from "./screens/CoupleSetupScreen";
import DashboardScreen from "./screens/DashboardScreen";
import TransactionsScreen from "./screens/TransactionsScreen";
import SettingsScreen from "./screens/SettingsScreen";
import BottomNav from "./components/BottomNav";

const DebtScreen = lazy(() => import("./screens/DebtScreen"));
const CategoriesScreen = lazy(() => import("./screens/CategoriesScreen"));
const AddTransactionScreen = lazy(() => import("./screens/AddTransactionScreen"));
const RecurringScreen = lazy(() => import("./screens/RecurringScreen"));
const WealthScreen = lazy(() => import("./screens/WealthScreen"));
const AddAssetScreen = lazy(() => import("./screens/AddAssetScreen"));
const MemberBreakdownScreen = lazy(() => import("./screens/MemberBreakdownScreen"));
const InvestmentCalculatorScreen = lazy(() => import("./screens/InvestmentCalculatorScreen"));
const ThemeScreen = lazy(() => import("./screens/ThemeScreen"));
const LanguageScreen = lazy(() => import("./screens/LanguageScreen"));

function RecurringGeneratorRunner() {
  useRecurringGenerator();
  return null;
}

function ModalWrapper({ onClose, children }) {
  return (
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
      <div style={{ padding: "1.5rem 1.25rem 0" }}>
        <button
          onClick={onClose}
          aria-label="Fermer"
          style={{ background: "none", border: "none", marginBottom: 8 }}
        >
          <i className="ti ti-x" style={{ fontSize: 20 }} aria-hidden="true" />
        </button>
      </div>
      {children}
    </div>
  );
}

function AppContent() {
  const { user, coupleId, loading } = useAuth();
  const [tab, setTab] = useState("dashboard");
  const [showAdd, setShowAdd] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [showRecurring, setShowRecurring] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [showDebt, setShowDebt] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showTheme, setShowTheme] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);

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

  function handleCentralAdd(currentTab) {
    if (currentTab === "wealth") {
      setShowAddAsset(true);
    } else {
      setShowAdd(true);
    }
  }

  return (
    <FinanceProvider>
      <RecurringGeneratorRunner />

      {tab === "dashboard" && (
        <DashboardScreen
          onOpenDebt={() => setShowDebt(true)}
          onOpenBreakdown={() => setShowBreakdown(true)}
        />
      )}
      {tab === "transactions" && <TransactionsScreen onEdit={openEdit} />}
      {tab === "wealth" && (
        <Suspense fallback={null}>
          <WealthScreen onOpenCalculator={() => setShowCalculator(true)} />
        </Suspense>
      )}
      {tab === "settings" && (
        <SettingsScreen
          onOpenRecurring={() => setShowRecurring(true)}
          onOpenCategories={() => setShowCategories(true)}
          onOpenTheme={() => setShowTheme(true)}
          onOpenLanguage={() => setShowLanguage(true)}
        />
      )}

      <BottomNav active={tab} onChange={setTab} onAddClick={handleCentralAdd} />

      <Suspense fallback={null}>
        {showAdd && <AddTransactionScreen onClose={closeAdd} editingTx={editingTx} />}
        {showAddAsset && <AddAssetScreen onClose={() => setShowAddAsset(false)} />}
        {showBreakdown && <MemberBreakdownScreen onClose={() => setShowBreakdown(false)} />}
        {showRecurring && <RecurringScreen onClose={() => setShowRecurring(false)} />}
        {showCalculator && (
          <InvestmentCalculatorScreen onClose={() => setShowCalculator(false)} />
        )}
        {showCategories && (
          <ModalWrapper onClose={() => setShowCategories(false)}>
            <CategoriesScreen />
          </ModalWrapper>
        )}
        {showDebt && (
          <ModalWrapper onClose={() => setShowDebt(false)}>
            <DebtScreen />
          </ModalWrapper>
        )}
        {showTheme && (
          <div style={{ position: "fixed", inset: 0, background: "var(--bg)", zIndex: 100, overflowY: "auto", maxWidth: 480, margin: "0 auto" }}>
            <ThemeScreen onClose={() => setShowTheme(false)} />
          </div>
        )}
        {showLanguage && (
          <div style={{ position: "fixed", inset: 0, background: "var(--bg)", zIndex: 100, overflowY: "auto", maxWidth: 480, margin: "0 auto" }}>
            <LanguageScreen onClose={() => setShowLanguage(false)} />
          </div>
        )}
      </Suspense>
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
