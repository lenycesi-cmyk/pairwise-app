import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { FinanceProvider, useFinance } from "./context/FinanceContext";
import { getMemberKey } from "./utils/members";
import { DEFAULT_NAV_TABS, resolveNavTabs } from "./data/navTabsMeta";
import { useRecurringGenerator } from "./hooks/useRecurringGenerator";
import { useBudgetAlerts } from "./hooks/useBudgetAlerts";
import { useBudgetSnapshots } from "./hooks/useBudgetSnapshots";
import { useCommentNotifications } from "./hooks/useCommentNotifications";
import { useRecurringReminders } from "./hooks/useRecurringReminders";
import { useGoalCelebration } from "./hooks/useGoalCelebration";
import { usePushNotifications, useForegroundPush } from "./hooks/usePushNotifications";
import { useBackGuard } from "./hooks/useBackGuard";
import { useTabSwipe } from "./hooks/useTabSwipe";
import { useScrollFocus } from "./hooks/useScrollFocus";
import { useTranslation } from "./hooks/useTranslation";
import OfflineBanner from "./components/OfflineBanner";
import Celebration from "./components/Celebration";
import SuccessCheck from "./components/SuccessCheck";
import AuthScreen from "./screens/AuthScreen";
import OnboardingFlowPreCouple from "./screens/OnboardingFlowPreCouple";
import OnboardingFlowPostCouple from "./screens/OnboardingFlowPostCouple";
import DashboardScreen from "./screens/DashboardScreen";
import BottomNav from "./components/BottomNav";
import BottomTabBar from "./components/BottomTabBar";

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
const CreditScreen = lazy(() => import("./screens/CreditScreen"));
const FluxScreen = lazy(() => import("./screens/FluxScreen"));
const GoalsScreen = lazy(() => import("./screens/GoalsScreen"));
const AddAssetScreen = lazy(() => import("./screens/AddAssetScreen"));
const MemberBreakdownScreen = lazy(() => import("./screens/MemberBreakdownScreen"));
const InvestmentCalculatorScreen = lazy(() => import("./screens/InvestmentCalculatorScreen"));
const ThemeScreen = lazy(() => import("./screens/ThemeScreen"));
const LanguageScreen = lazy(() => import("./screens/LanguageScreen"));
// Lazy : embarque @dnd-kit (réordonnancement), à garder hors du bundle initial.
const NavTabsPicker = lazy(() => import("./components/NavTabsPicker"));

// L'ordre de la navigation par swipe suit désormais les onglets choisis dans la
// barre du bas (par membre). NavSwipeSync (sous FinanceProvider) le remonte à
// AppContent, qui le passe à useTabSwipe. Défaut : DEFAULT_NAV_TABS.
function NavSwipeSync({ onOrder }) {
  const { members, navTabs } = useFinance();
  const { user } = useAuth();
  const myKey = getMemberKey(members.find((m) => m.uid === user?.uid));
  const order = resolveNavTabs(navTabs[myKey]);
  const key = order.join(",");
  useEffect(() => {
    onOrder(order);
    // `key` capture le contenu de `order` ; on ne dépend que de lui.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

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

function GoalCelebrationRunner() {
  useGoalCelebration();
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
  const [showNavPicker, setShowNavPicker] = useState(false);
  // Ordre du swipe = onglets de la barre du bas du membre (mis à jour par
  // NavSwipeSync, rendu sous FinanceProvider).
  const [swipeOrder, setSwipeOrder] = useState(DEFAULT_NAV_TABS);
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
  const [addAssetType, setAddAssetType] = useState(null);
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
  const [creditAddSignal, setCreditAddSignal] = useState(0);
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
  useTabSwipe({ order: swipeOrder, active: tab, onChange: setTab, enabledRef: swipeEnabledRef });

  // Sens de la transition glissée : « fwd » (depuis la droite) si le nouvel
  // onglet est plus loin dans l'ordre, « back » sinon. On lit l'onglet précédent
  // via un ref (encore l'ancienne valeur pendant le rendu du changement) puis on
  // le met à jour après coup.
  const prevTabRef = useRef(tab);
  const tabDir =
    swipeOrder.indexOf(tab) < swipeOrder.indexOf(prevTabRef.current) ? "back" : "fwd";
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
      setAddAssetType(null);
      setShowAddAsset(true);
    } else if (currentTab === "budget") {
      setBudgetAddSignal((s) => s + 1);
    } else if (currentTab === "goals") {
      setGoalsAddSignal((s) => s + 1);
    } else if (currentTab === "credits") {
      setCreditAddSignal((s) => s + 1);
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
      <NavSwipeSync onOrder={setSwipeOrder} />
      <RecurringGeneratorRunner />
      <ScrollFocusRunner />
      <BudgetAlertsRunner />
      <BudgetSnapshotRunner />
      <CommentNotifierRunner />
      <RecurringRemindersRunner />
      <GoalCelebrationRunner />
      <PushRunner />
      <OfflineBanner />
      <Celebration />
      <SuccessCheck />

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
          onOpenCredits={() => setTab("credits")}
          onAddAsset={() => { setAddAssetType("account"); setShowAddAsset(true); }}
          onAddBudget={() => { setTab("budget"); setBudgetAddSignal((s) => s + 1); }}
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
          <WealthScreen onOpenCalculator={() => setShowCalculator(true)} addButtonRef={addButtonRef} onOpenMenu={() => setDrawerOpen(true)} onOpenCredits={() => setTab("credits")} />
        </Suspense>
      )}
      {tab === "credits" && (
        <Suspense fallback={null}>
          <CreditScreen openSignal={creditAddSignal} onOpenMenu={() => setDrawerOpen(true)} />
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
            onOpenNavPicker={() => setShowNavPicker(true)}
          />
        </Suspense>
      )}
      </div>

      {/* Barre de navigation du bas (mobile) : 2 onglets · bouton « + » central ·
          2 onglets, personnalisables. Masquée en CSS sur desktop (rail latéral).
          Appui long → sélecteur d'onglets. */}
      <BottomTabBar
        active={tab}
        onChange={setTab}
        onAddClick={handleCentralAdd}
        onLongPressEdit={() => setShowNavPicker(true)}
      />

      <Suspense fallback={null}>
        {showNavPicker && <NavTabsPicker onClose={() => setShowNavPicker(false)} />}
      </Suspense>

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
        {showAddAsset && <AddAssetScreen onClose={() => setShowAddAsset(false)} initialTypeId={addAssetType} />}
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
