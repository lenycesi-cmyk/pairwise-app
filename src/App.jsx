import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { FinanceProvider } from "./context/FinanceContext";
import { useRecurringGenerator } from "./hooks/useRecurringGenerator";
import { useBudgetAlerts } from "./hooks/useBudgetAlerts";
import { useBudgetSnapshots } from "./hooks/useBudgetSnapshots";
import { useCommentNotifications } from "./hooks/useCommentNotifications";
import { useRecurringReminders } from "./hooks/useRecurringReminders";
import { usePushNotifications, useForegroundPush } from "./hooks/usePushNotifications";
import { useBackGuard } from "./hooks/useBackGuard";
import { useTabSwipe } from "./hooks/useTabSwipe";
import { useScrollFocus } from "./hooks/useScrollFocus";
import { useTranslation } from "./hooks/useTranslation";
import OfflineBanner from "./components/OfflineBanner";
import AuthScreen from "./screens/AuthScreen";
import OnboardingFlowPreCouple from "./screens/OnboardingFlowPreCouple";
import OnboardingFlowPostCouple from "./screens/OnboardingFlowPostCouple";
import DashboardScreen from "./screens/DashboardScreen";
import BottomNav from "./components/BottomNav";

const TransactionsScreen = lazy(() => import("./screens/TransactionsScreen"));
const SettingsScreen = lazy(() => import("./screens/SettingsScreen"));
const ReportsScreen = lazy(() => import("./screens/ReportsScreen"));
const BudgetScreen = lazy(() => import("./screens/BudgetScreen"));
const DebtScreen = lazy(() => import("./screens/DebtScreen"));
const CategoriesScreen = lazy(() => import("./screens/CategoriesScreen"));
const TagsScreen = lazy(() => import("./screens/TagsScreen"));
const AddTransactionScreen = lazy(() => import("./screens/AddTransactionScreen"));
const RecurringScreen = lazy(() => import("./screens/RecurringScreen"));
const WealthScreen = lazy(() => import("./screens/WealthScreen"));
const FluxScreen = lazy(() => import("./screens/FluxScreen"));
const GoalsScreen = lazy(() => import("./screens/GoalsScreen"));
const AddAssetScreen = lazy(() => import("./screens/AddAssetScreen"));
const MemberBreakdownScreen = lazy(() => import("./screens/MemberBreakdownScreen"));
const InvestmentCalculatorScreen = lazy(() => import("./screens/InvestmentCalculatorScreen"));
const ThemeScreen = lazy(() => import("./screens/ThemeScreen"));
const LanguageScreen = lazy(() => import("./screens/LanguageScreen"));

// Ordre des onglets principaux pour la navigation par swipe (le « + » central
// n'est pas un onglet ; Réglages est une modale, hors du cycle).
const TAB_SWIPE_ORDER = ["dashboard", "reports", "budget", "wealth"];

function RecurringGeneratorRunner() {
  useRecurringGenerator();
  return null;
}

function ScrollFocusRunner() {
  useScrollFocus();
  return null;
}

function BudgetAlertsRunner() {
  useBudgetAlerts();
  return null;
}

function BudgetSnapshotRunner() {
  useBudgetSnapshots();
  return null;
}

function CommentNotifierRunner() {
  useCommentNotifications();
  return null;
}

function RecurringRemindersRunner() {
  useRecurringReminders();
  return null;
}

// Rafraîchit le token FCM à chaque lancement (pas seulement à l'ouverture des
// Réglages) et affiche les push reçus app au premier plan.
function PushRunner() {
  usePushNotifications();
  useForegroundPush();
  return null;
}

// Rend une clé de traduction — utilisable comme `title` de ModalWrapper
// (doit être rendu sous FinanceProvider, ce qui est le cas des modals).
// FAB « Ajouter » flottant (mobile). Rendu sous FinanceProvider pour accéder à
// la traduction ; masqué en CSS sur desktop (le rail latéral porte l'ajout).
function AddFab({ onClick }) {
  const t = useTranslation();
  return (
    <button className="nav-fab" onClick={onClick} aria-label={t("nav_add")}>
      <i className="ti ti-plus" aria-hidden="true" />
      <span>{t("nav_add")}</span>
    </button>
  );
}

// Rend une clé de traduction — utilisable comme `title` de ModalWrapper.
function TranslatedTitle({ k }) {
  const t = useTranslation();
  return t(k);
}

function ModalWrapper({ onClose, title, children }) {
  return (
    <div className="app-modal">
      {/* Sticky : le bouton fermer (et le titre éventuel) restent visibles
          pendant le défilement du contenu du modal. */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "var(--bg)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 20px",
          borderBottom: "0.5px solid var(--rule)",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Fermer"
          style={{ width: 32, height: 32, borderRadius: 99, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "color-mix(in srgb, var(--ink) 6%, transparent)", border: "none", color: "var(--ink-2)", cursor: "pointer" }}
        >
          <i className="ti ti-x" style={{ fontSize: 17 }} aria-hidden="true" />
        </button>
        <h1 style={{ flex: 1, textAlign: "center", margin: 0, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--ink)" }}>{title}</h1>
        <span style={{ width: 32, height: 32, flexShrink: 0 }} />
      </div>
      {children}
    </div>
  );
}

function AppContent() {
  const { user, coupleId, onboardingComplete, loading } = useAuth();
  const [tab, setTab] = useState("dashboard");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [editReturnTo, setEditReturnTo] = useState(null);
  const [showRecurring, setShowRecurring] = useState(false);
  const [recurringEditId, setRecurringEditId] = useState(null);
  const [showCategories, setShowCategories] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [showDebt, setShowDebt] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showTheme, setShowTheme] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);
  // Un·e utilisateur·rice existant·e qui clique "Se connecter" depuis l'accueil
  // de l'onboarding : on affiche l'écran de connexion classique au lieu du
  // parcours "valeur d'abord".
  const [showLogin, setShowLogin] = useState(false);
  // Selected month shared between Home and Reports so switching tabs doesn't
  // silently jump back to the current month (both only ever browse by month;
  // Reports' quarter/year/last12/custom modes stay local to that screen).
  const now = new Date();
  const [sharedMonth, setSharedMonth] = useState({ month: now.getMonth(), year: now.getFullYear() });
  const [budgetAddSignal, setBudgetAddSignal] = useState(0);
  const [goalsAddSignal, setGoalsAddSignal] = useState(0);
  const addButtonRef = useRef(null);
  const settingsButtonRef = useRef(null);

  // Bouton "retour" du téléphone : referme l'overlay courant (ou revient à
  // l'accueil depuis un autre onglet) au lieu de quitter l'app. Appelés
  // inconditionnellement, avant tout return anticipé, pour garder un ordre de
  // hooks stable. closeAdd/closeRecurring sont hoistés (déclarations function).
  // Sentinelle persistante (racine) : empêche le bouton "retour" du téléphone de
  // FERMER l'app depuis l'accueil — il ré-empile une entrée d'historique au lieu
  // de quitter. Doit être le PREMIER useBackGuard (fond de pile) pour que les
  // overlays/onglets, empilés au-dessus, soient traités avant.
  useBackGuard(true, () => {}, { persistent: true });
  useBackGuard(tab !== "dashboard", () => setTab("dashboard"));
  useBackGuard(showAdd, () => closeAdd());
  useBackGuard(showAddAsset, () => setShowAddAsset(false));
  useBackGuard(showBreakdown, () => setShowBreakdown(false));
  useBackGuard(showCalculator, () => setShowCalculator(false));
  useBackGuard(showDebt, () => setShowDebt(false));
  useBackGuard(showTransactions, () => setShowTransactions(false));
  useBackGuard(showRecurring, () => closeRecurring());
  useBackGuard(showCategories, () => setShowCategories(false));
  useBackGuard(showTags, () => setShowTags(false));
  useBackGuard(showTheme, () => setShowTheme(false));
  useBackGuard(showLanguage, () => setShowLanguage(false));
  useBackGuard(drawerOpen, () => setDrawerOpen(false));

  // Swipe horizontal entre onglets (mobile). Coupé quand un overlay/modale est
  // ouvert (on met à jour le ref à chaque rendu sans réattacher les écouteurs).
  const anyOverlay =
    showAdd || showAddAsset || showBreakdown || showCalculator || showDebt ||
    showTransactions || showRecurring || showCategories ||
    showTags || showTheme || showLanguage || showLogin || drawerOpen;
  const swipeEnabledRef = useRef(true);
  swipeEnabledRef.current = !anyOverlay;
  useTabSwipe({ order: TAB_SWIPE_ORDER, active: tab, onChange: setTab, enabledRef: swipeEnabledRef });

  // Sens de la transition glissée : « fwd » (depuis la droite) si le nouvel
  // onglet est plus loin dans l'ordre, « back » sinon. On lit l'onglet précédent
  // via un ref (encore l'ancienne valeur pendant le rendu du changement) puis on
  // le met à jour après coup.
  const prevTabRef = useRef(tab);
  const tabDir =
    TAB_SWIPE_ORDER.indexOf(tab) < TAB_SWIPE_ORDER.indexOf(prevTabRef.current) ? "back" : "fwd";
  useEffect(() => {
    prevTabRef.current = tab;
  }, [tab]);

  if (loading) {
    return (
      <div style={{ padding: "2rem 1.5rem" }}>
        <div className="skeleton" style={{ height: 40, width: 120, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 100, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  // Onboarding "valeur d'abord" (option A) : tant qu'il n'y a pas d'espace
  // couple, on déroule Accueil → Aha → Solo/Couple → Sign-up (pré-couple).
  // Un·e utilisateur·rice existant·e peut basculer sur la connexion classique.
  if (!coupleId) {
    if (showLogin && !user) return <AuthScreen onBack={() => setShowLogin(false)} />;
    return <OnboardingFlowPreCouple onSignIn={() => setShowLogin(true)} />;
  }

  function openEdit(tx, returnTo = null) {
    setEditingTx(tx);
    setEditReturnTo(returnTo);
    setShowAdd(true);
  }

  function closeAdd() {
    setShowAdd(false);
    setEditingTx(null);
    if (editReturnTo === "transactions") setShowTransactions(true);
    setEditReturnTo(null);
  }

  function openRecurring(id = null) {
    setRecurringEditId(id);
    setShowRecurring(true);
  }

  function closeRecurring() {
    setShowRecurring(false);
    setRecurringEditId(null);
  }

  function handleCentralAdd(currentTab) {
    if (currentTab === "wealth") {
      setShowAddAsset(true);
    } else if (currentTab === "budget") {
      setBudgetAddSignal((s) => s + 1);
    } else if (currentTab === "goals") {
      setGoalsAddSignal((s) => s + 1);
    } else {
      setShowAdd(true);
    }
  }

  if (!onboardingComplete) {
    return (
      <FinanceProvider>
        <OnboardingFlowPostCouple />
      </FinanceProvider>
    );
  }

  return (
    <FinanceProvider>
      <RecurringGeneratorRunner />
      <ScrollFocusRunner />
      <BudgetAlertsRunner />
      <BudgetSnapshotRunner />
      <CommentNotifierRunner />
      <RecurringRemindersRunner />
      <PushRunner />
      <OfflineBanner />

      <div className="tab-slide" key={tab} data-dir={tabDir}>
      {tab === "dashboard" && (
        <DashboardScreen
          onOpenDebt={() => setShowDebt(true)}
          onOpenBreakdown={() => setShowBreakdown(true)}
          onOpenTransactions={() => setShowTransactions(true)}
          onEditTransaction={openEdit}
          sharedMonth={sharedMonth}
          onSharedMonthChange={setSharedMonth}
          addButtonRef={addButtonRef}
          settingsButtonRef={settingsButtonRef}
          onOpenMenu={() => setDrawerOpen(true)}
          onOpenRecurring={openRecurring}
          onOpenBudget={() => setTab("budget")}
        />
      )}
      {tab === "flux" && (
        <Suspense fallback={null}>
          <FluxScreen
            onOpenMenu={() => setDrawerOpen(true)}
            onOpenTransactions={() => setShowTransactions(true)}
            onOpenRecurring={openRecurring}
            onEditTransaction={openEdit}
            sharedMonth={sharedMonth}
            onSharedMonthChange={setSharedMonth}
          />
        </Suspense>
      )}
      {tab === "goals" && (
        <Suspense fallback={null}>
          <GoalsScreen onOpenMenu={() => setDrawerOpen(true)} openSignal={goalsAddSignal} />
        </Suspense>
      )}
      {tab === "reports" && (
        <Suspense fallback={null}>
          <ReportsScreen
            onOpenBreakdown={() => setShowBreakdown(true)}
            sharedMonth={sharedMonth}
            onSharedMonthChange={setSharedMonth}
            onOpenMenu={() => setDrawerOpen(true)}
          />
        </Suspense>
      )}
      {tab === "wealth" && (
        <Suspense fallback={null}>
          <WealthScreen onOpenCalculator={() => setShowCalculator(true)} addButtonRef={addButtonRef} onOpenMenu={() => setDrawerOpen(true)} />
        </Suspense>
      )}
      {tab === "budget" && (
        <Suspense fallback={null}>
          <BudgetScreen openSignal={budgetAddSignal} onOpenMenu={() => setDrawerOpen(true)} />
        </Suspense>
      )}
      {tab === "settings" && (
        <Suspense fallback={null}>
          <SettingsScreen
            onOpenMenu={() => setDrawerOpen(true)}
            onOpenRecurring={() => openRecurring()}
            onOpenCategories={() => setShowCategories(true)}
            onOpenTags={() => setShowTags(true)}
            onOpenTheme={() => setShowTheme(true)}
            onOpenLanguage={() => setShowLanguage(true)}
          />
        </Suspense>
      )}
      </div>

      {/* FAB « Ajouter » flottant (mobile) — masqué en CSS sur desktop, où le
          bouton d'ajout vit dans le rail latéral. */}
      <AddFab onClick={() => handleCentralAdd(tab)} />

      <BottomNav
        active={tab}
        onChange={setTab}
        onAddClick={handleCentralAdd}
        addButtonRef={addButtonRef}
        onSettingsClick={() => setTab("settings")}
        settingsOpen={tab === "settings"}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      <Suspense fallback={null}>
        {showAdd && <AddTransactionScreen onClose={closeAdd} editingTx={editingTx} />}
        {showAddAsset && <AddAssetScreen onClose={() => setShowAddAsset(false)} />}
        {showBreakdown && <MemberBreakdownScreen onClose={() => setShowBreakdown(false)} />}
        {showCalculator && (
          <InvestmentCalculatorScreen onClose={() => setShowCalculator(false)} />
        )}
        {showDebt && (
          <ModalWrapper onClose={() => setShowDebt(false)} title={<TranslatedTitle k="debt_title" />}>
            <DebtScreen />
          </ModalWrapper>
        )}
        {showTransactions && (
          <ModalWrapper onClose={() => setShowTransactions(false)}>
            <TransactionsScreen
              onEdit={(tx) => {
                setShowTransactions(false);
                openEdit(tx, "transactions");
              }}
            />
          </ModalWrapper>
        )}
        {showRecurring && <RecurringScreen onClose={closeRecurring} initialEditId={recurringEditId} />}
        {showCategories && (
          <ModalWrapper onClose={() => setShowCategories(false)} title={<TranslatedTitle k="categories_title" />}>
            <CategoriesScreen />
          </ModalWrapper>
        )}
        {showTags && (
          <ModalWrapper onClose={() => setShowTags(false)} title={<TranslatedTitle k="categories_tags_title" />}>
            <TagsScreen />
          </ModalWrapper>
        )}
        {showTheme && (
          <div className="app-modal">
            <ThemeScreen onClose={() => setShowTheme(false)} />
          </div>
        )}
        {showLanguage && (
          <div className="app-modal">
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
