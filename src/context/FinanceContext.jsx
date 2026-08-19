import { createContext, useContext, useState, useEffect, useMemo } from "react";
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
  deleteField,
} from "firebase/firestore";
import { db } from "../firebase";
import { newInviteExpiry } from "../utils/coupleCode";
import { applyTheme } from "../data/themes";
import { useAuth } from "./AuthContext";
import { ALL_CATEGORIES } from "../data/categories";
import { ASSET_TYPES } from "../data/assetTypes";
import { getMemberKey } from "../utils/members";
import { getExchangeRate } from "../utils/currencyConversion";
import { sendPushNotification } from "../utils/sendPush";
import { dedupeTags } from "../utils/tags";
import { receiptPathOf } from "../utils/receiptPaths";
import { purgeReceiptPaths } from "../utils/purgeReceipts";
import {
  buildExportDocument,
  parseExportDocument,
  buildCouplePatch,
  summarizeImport,
} from "../utils/canonicalData";
import { createCoupleAdapter } from "./coupleAdapter";
import { removeFrom, findIn } from "../utils/collectionOps";
import { partitionArchived, mergeReorder, isArchived } from "../utils/archive";
import { resolveNavTabs } from "../data/navTabsMeta";
import { readBootTheme, writeBootTheme, readBootNavTabs, writeBootNavTabs } from "../utils/bootPrefs";
import { readHideAmounts, writeHideAmounts } from "../utils/hideAmounts";

const FinanceContext = createContext(null);

export function FinanceProvider({ children }) {
  const { coupleId, user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState(ALL_CATEGORIES);
  const [members, setMembers] = useState([]);
  const [coupleName, setCoupleName] = useState("");
  const [loading, setLoading] = useState(true);
  // Le document couple est-il ARRIVÉ ? À distinguer de `loading`, qui suit
  // l'écoute des TRANSACTIONS (sous-collection distincte, latence distincte).
  //
  // Sans ce drapeau, `members` vaut `[]` entre le montage et la livraison du
  // snapshot, ce qui rend `isSolo` VRAI à tort : l'app se croit en espace solo
  // le temps d'un aller-retour réseau. Ce n'est pas cosmétique — en solo, la
  // saisie de transaction masque la carte « Payé par / Pour » ET écrit
  // l'attribution sur le membre unique, donc une transaction enregistrée dans
  // cette fenêtre part à 100 % pour son auteur·rice au lieu du partage voulu.
  // Invisible sur un appareil au cache chaud, systématique sur un appareil
  // lent ou après vidage du cache.
  const [coupleLoaded, setCoupleLoaded] = useState(false);
  const [defaultCurrency, setDefaultCurrency] = useState("EUR");
  const [currencyMode, setCurrencyMode] = useState("fixed");
  // "shared" (défaut, historique) : chacun ses finances, on suit qui doit quoi
  // (split + debt tracker). "common" : compte commun, pas de dette entre
  // partenaires — on garde le suivi "qui dépense quoi et pour qui".
  const [financeMode, setFinanceMode] = useState("shared");
  const [inviteExpiresAt, setInviteExpiresAt] = useState(null);
  // Devises proposées dans les sélecteurs (ajout de transaction...). null =
  // toutes les devises (défaut) ; sinon la liste blanche choisie par le couple.
  const [enabledCurrencies, setEnabledCurrencies] = useState(null);
  const [lastUsedCurrency, setLastUsedCurrency] = useState("EUR");
  const [recurringTx, setRecurringTx] = useState([]);
  // Dernière génération PAR règle, stockée hors du tableau recurringTx (champ
  // map dédié) : le générateur écrit ici sans réécrire tout le tableau, ce qui
  // évitait qu'une génération en vol écrase une édition simultanée de la règle
  // (ex. changement de devise reverté). Clé = id de règle → date ISO.
  const [recurringLastGen, setRecurringLastGen] = useState({});
  // Versements programmés vers des actifs (lot 3) + suivi d'application par période.
  const [assetContributions, setAssetContributions] = useState([]);
  const [assetContributionsApplied, setAssetContributionsApplied] = useState({});
  // Allocation cible du patrimoine par type d'actif ({ typeId: pourcentage }).
  const [targetAllocation, setTargetAllocationState] = useState({});
  const [budgets, setBudgets] = useState([]);
  const [loans, setLoans] = useState([]);
  const [goals, setGoals] = useState([]);
  const [budgetHistory, setBudgetHistory] = useState({});
  const [incomeAccountLinks, setIncomeAccountLinksState] = useState({});
  const [assets, setAssets] = useState([]);
  const [netWorthHistory, setNetWorthHistory] = useState([]);
  const [wealthDisplayCurrency, setWealthDisplayCurrency] = useState(null);
  const [dashboardDisplayCurrency, setDashboardDisplayCurrency] = useState(null);
  const [budgetDisplayCurrency, setBudgetDisplayCurrency] = useState(null);
  // Le thème (clair « pairwise » / nuit « pairwise-dark ») est PROPRE À CHAQUE
  // MEMBRE : stocké dans la map `themePrefs.{memberKey}` du doc couple, jamais
  // dans un champ partagé — passer en mode nuit ne doit pas repeindre l'écran
  // du partenaire. `legacyTheme` porte l'ancien champ `theme` partagé et sert
  // de repli tant qu'un membre n'a pas choisi le sien (pas de régression pour
  // les couples qui l'avaient déjà réglé).
  const [themePrefs, setThemePrefs] = useState({});
  const [legacyTheme, setLegacyTheme] = useState(null);
  const [language, setLanguageState] = useState("fr");
  const [debtSettlements, setDebtSettlements] = useState([]);
  // Virements directs entre les deux membres (ex. un partenaire dépanne
  // l'autre en liquidités locales) — distincts d'un règlement : un règlement
  // remet le solde à zéro sans montant, un virement réduit le solde d'un
  // montant précis sans le solder. Voir addDebtTransfer plus bas.
  const [debtTransfers, setDebtTransfers] = useState([]);
  const [pushPrefs, setPushPrefs] = useState({});
  // navTabs.{memberKey} = [tabKey, tabKey, tabKey, tabKey] : les 4 onglets de la
  // barre de navigation du bas (mobile), personnalisables par membre.
  const [navTabs, setNavTabs] = useState({});
  // customTagsByMember.{memberKey} = [tag, tag, …] : la liste de tags en accès
  // rapide est PROPRE À CHAQUE MEMBRE (même motif que pushPrefs / navTabs).
  // Les habitudes d'étiquetage ne se partagent pas — voir `customTags` plus bas
  // pour la résolution et la reprise de l'ancienne liste commune.
  const [customTagsByMember, setCustomTagsByMember] = useState({});
  // Ancienne liste COMMUNE au couple. Conservée en lecture seule : elle sert de
  // point de départ à qui n'a pas encore sa propre liste (voir `customTags`).
  const [legacyCustomTags, setLegacyCustomTags] = useState([]);
  // Masquage des montants : réglage D'APPAREIL (voir utils/hideAmounts), donc
  // hors du document couple — il ne se synchronise pas avec le/la partenaire.
  const [hideAmounts, setHideAmountsState] = useState(readHideAmounts);

  // Archivage : `budgets`/`goals` gardent le tableau COMPLET en état (les
  // écritures font un read-modify-write dessus et doivent voir les archivés),
  // mais le contexte n'expose que les actifs. Le filtre est ici et nulle part
  // ailleurs — sinon il faudrait le répéter dans useBudgetProgress,
  // useBudgetSnapshots, useGoalProgress et les widgets, et en oublier un.
  const { active: activeBudgets, archived: archivedBudgets } = useMemo(
    () => partitionArchived(budgets),
    [budgets]
  );
  const { active: activeGoals, archived: archivedGoals } = useMemo(
    () => partitionArchived(goals),
    [goals]
  );

  // La valeur suivante est calculée AVANT, jamais dans l'updater : celui-ci doit
  // rester pur (React peut le rejouer), et une écriture localStorage à
  // l'intérieur serait donc exécutée deux fois.
  function toggleHideAmounts() {
    const next = !hideAmounts;
    setHideAmountsState(next);
    writeHideAmounts(next);
  }

  // Clé du membre courant : sert autant à filtrer le privé (voir isVisibleToMe)
  // qu'à retrouver SON thème dans la map.
  const myKey = getMemberKey(members.find((m) => m.uid === user?.uid)) || user?.uid;

  // Tags en accès rapide DU MEMBRE COURANT. Trois états, dans cet ordre :
  //
  //   1. le membre a sa propre liste → on la sert ;
  //   2. il n'en a pas encore → on repart de l'ancienne liste commune, si bien
  //      que le passage au par-membre ne fait disparaître les tags de personne
  //      (chacun hérite de l'existant puis s'en écarte à sa première
  //      modification, sans reprise de données ni écriture de migration) ;
  //   3. rien nulle part → tableau vide, et les consommateurs retombent sur les
  //      presets comme avant.
  //
  // Un tableau VIDE reste une liste valide (« j'ai tout retiré ») : le test
  // porte donc sur la présence de la clé, pas sur la longueur — sinon vider sa
  // liste ferait réapparaître celle du couple.
  const customTags = useMemo(
    () => (myKey && customTagsByMember[myKey]) || legacyCustomTags,
    [customTagsByMember, myKey, legacyCustomTags]
  );

  // Couture de persistance : TOUTE écriture sur le document couple passe par là
  // (cf. context/coupleAdapter.js). Le mode Local n'aura qu'à en fournir une
  // seconde implémentation.
  const couple = useMemo(() => createCoupleAdapter(coupleId), [coupleId]);
  // Tant que le document du couple n'est pas arrivé, on repart de la valeur
  // mise en cache au dernier passage (cf. utils/bootPrefs) plutôt que du thème
  // clair : sinon l'app démarre en clair puis bascule en nuit sous les yeux de
  // l'utilisateur. Firestore reste prioritaire dès qu'il répond.
  const theme = themePrefs[myKey] || legacyTheme || readBootTheme() || "pairwise";

  useEffect(() => {
    applyTheme(theme);
    writeBootTheme(theme);
  }, [theme]);

  // Onglets de la barre du bas, résolus une seule fois ici pour tous les
  // consommateurs (BottomTabBar, ordre de swipe). Même logique que le thème :
  // on affiche les onglets mémorisés en attendant les vrais, ce qui évite de
  // montrer les onglets par défaut pendant la première seconde.
  const myNavTabs = useMemo(
    () => resolveNavTabs(navTabs[myKey] || readBootNavTabs()),
    [navTabs, myKey]
  );

  useEffect(() => {
    // On ne mémorise qu'une valeur venue de Firestore — sans cette garde, le
    // repli par défaut du tout premier démarrage se figerait dans le cache.
    if (navTabs[myKey]) writeBootNavTabs(myNavTabs);
  }, [navTabs, myKey, myNavTabs]);

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
        if (data.members) {
          setMembers(data.members);
          // Resynchronise memberUids sur les membres réels. À l'origine un
          // backfill pour les espaces créés avant l'existence du champ ; ce rôle
          // est caduc (plus aucun document sans memberUids, et `allow create`
          // interdit d'en produire). Il reste utile comme garde-fou de cohérence
          // si members et memberUids venaient à diverger. Idempotent : ne réécrit
          // que sur divergence.
          //
          // ATTENTION : depuis le retrait de la tolérance dans firestore.rules,
          // un memberUids incorrect verrouille le couple pour de bon. Ne jamais
          // faire écrire ici une liste qui ne dérive pas des `members` réels.
          const realUids = data.members.map((m) => m.uid).filter(Boolean);
          const current = Array.isArray(data.memberUids) ? data.memberUids.filter(Boolean) : null;
          const same = current && current.length === realUids.length && realUids.every((u) => current.includes(u));
          if (!same) {
            couple.setFields({ memberUids: realUids }).catch(() => {});
          }
        }
        if (data.coupleName !== undefined) setCoupleName(data.coupleName);
        if (data.currencyMode) setCurrencyMode(data.currencyMode);
        if (data.financeMode) setFinanceMode(data.financeMode);
        setInviteExpiresAt(
          typeof data.inviteExpiresAt === "number" ? data.inviteExpiresAt : null
        );
        if (Array.isArray(data.enabledCurrencies)) setEnabledCurrencies(data.enabledCurrencies);
        // lastUsedCurrency est désormais PAR UTILISATEUR (users/{uid}) et non
        // plus au niveau du couple : deux partenaires dans des pays différents
        // gardent chacun leur dernière devise. Chargé dans l'effet dédié.
        if (data.recurringTx) setRecurringTx(data.recurringTx);
        if (data.recurringLastGen) setRecurringLastGen(data.recurringLastGen);
        if (data.budgets) setBudgets(data.budgets);
        if (data.loans) setLoans(data.loans);
        if (data.goals) setGoals(data.goals);
        if (data.budgetHistory) setBudgetHistory(data.budgetHistory);
        if (data.incomeAccountLinks) setIncomeAccountLinksState(data.incomeAccountLinks);
        if (data.assets) setAssets(data.assets);
        if (data.assetContributions) setAssetContributions(data.assetContributions);
        if (data.assetContributionsApplied) setAssetContributionsApplied(data.assetContributionsApplied);
        if (data.targetAllocation) setTargetAllocationState(data.targetAllocation);
        if (data.netWorthHistory) setNetWorthHistory(data.netWorthHistory);
        if (data.wealthDisplayCurrency) setWealthDisplayCurrency(data.wealthDisplayCurrency);
        if (data.dashboardDisplayCurrency) setDashboardDisplayCurrency(data.dashboardDisplayCurrency);
        if (data.budgetDisplayCurrency) setBudgetDisplayCurrency(data.budgetDisplayCurrency);
        if (data.themePrefs) setThemePrefs(data.themePrefs);
        if (data.theme) setLegacyTheme(data.theme);
        if (data.language) setLanguageState(data.language);
        if (data.debtSettlements) setDebtSettlements(data.debtSettlements);
        if (data.debtTransfers) setDebtTransfers(data.debtTransfers);
        if (data.pushPrefs) setPushPrefs(data.pushPrefs);
        if (data.navTabs) setNavTabs(data.navTabs);
        if (data.customTags) setLegacyCustomTags(data.customTags);
        if (data.customTagsByMember) setCustomTagsByMember(data.customTagsByMember);
      }
      // Marqué APRÈS l'application des champs, et même si le document n'existe
      // pas : dans les deux cas on sait désormais à quoi s'en tenir, alors que
      // rester « non chargé » figerait indéfiniment les écrans qui attendent.
      setCoupleLoaded(true);
    });

    return unsub;
  }, [coupleId, couple]);

  async function addTransaction(tx) {
    if (!coupleId) return;

    // Conversion figée au moment de la création (pas de recalcul dynamique ensuite).
    // Si aucun taux n'est disponible, on n'écrit AUCUN champ de conversion :
    // laisser `convertedAmount` absent fait retomber tous les écrans sur la
    // conversion à l'affichage (qui, elle, se corrige au rechargement), alors
    // qu'un chiffre inventé resterait faux pour toujours.
    const { rate, isFallback } = await getExchangeRate(tx.currency, defaultCurrency);
    const conversion =
      rate === null
        ? {}
        : {
            convertedAmount: tx.amount * rate,
            convertedCurrency: defaultCurrency,
            exchangeRate: rate,
            exchangeRateIsFallback: isFallback,
          };

    const docRef = await addDoc(collection(db, "couples", coupleId, "transactions"), {
      ...tx,
      ...conversion,
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

    // NOTE — le crédit automatique d'un compte du Patrimoine par les revenus
    // d'une sous-catégorie liée a été RETIRÉ avec son éditeur (Réglages →
    // Catégories). Garder l'automatisme sans écran pour l'éteindre revenait à
    // faire apparaître de l'argent sur un compte sans cause visible.
    // `incomeAccountLinks` reste stocké sur le doc couple, dormant : rien ne
    // l'applique, et un retour en arrière n'aurait aucune donnée à reconstituer.

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
      if (rate === null) {
        // Aucun taux : on EFFACE la conversion précédente au lieu d'en écrire
        // une fausse ou de laisser l'ancienne, qui se rapporterait désormais à
        // un autre montant ou à une autre devise. Champs absents ⇒ les écrans
        // reconvertissent à l'affichage.
        updates = {
          ...updates,
          convertedAmount: deleteField(),
          convertedCurrency: deleteField(),
          exchangeRate: deleteField(),
          exchangeRateIsFallback: deleteField(),
        };
      } else {
        updates = {
          ...updates,
          convertedAmount: amount * rate,
          convertedCurrency: defaultCurrency,
          exchangeRate: rate,
          exchangeRateIsFallback: isFallback,
        };
      }
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
    await couple.setFields(
      { pushPrefs: { [memberKey]: prefs } }
    );
  }

  // Onglets de la barre du bas d'UN membre (remplacement complet du tableau).
  async function updateMemberNavTabs(memberKey, tabs) {
    if (!coupleId) return;
    await couple.setFields(
      { navTabs: { [memberKey]: tabs } }
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
    // Le reçu se purge AVANT le document : une fois celui-ci supprimé, plus
    // rien ne dit quel objet Storage lui appartenait, et l'image resterait
    // accessible pour toujours par son URL à jeton. Best-effort : un échec de
    // purge ne doit pas empêcher la suppression demandée.
    const path = receiptPathOf(transactions.find((t) => t.id === id));
    if (path) await purgeReceiptPaths(coupleId, [path]);
    await deleteDoc(doc(db, "couples", coupleId, "transactions", id));
  }

  async function updateCategories(newCategories) {
    if (!coupleId) return;
    await couple.setFields(
      { categories: newCategories }
    );
  }

  // Écrit la liste DU MEMBRE COURANT. L'ancien champ commun `customTags` n'est
  // jamais réécrit : il reste le point de départ de qui n'a pas encore la
  // sienne, et l'écraser priverait le/la partenaire de sa propre reprise.
  async function updateCustomTags(tags) {
    if (!coupleId || !myKey) return;
    // Maj optimiste (le champ n'est pas re-fusionné ailleurs).
    setCustomTagsByMember((prev) => ({ ...prev, [myKey]: tags }));
    await couple.setFields(
      { customTagsByMember: { [myKey]: tags } }
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
    await couple.setFields(
      { defaultCurrency: currency }
    );
  }

  async function updateCurrencyMode(mode) {
    if (!coupleId) return;
    await couple.setFields(
      { currencyMode: mode }
    );
  }

  async function updateFinanceMode(mode) {
    if (!coupleId) return;
    setFinanceMode(mode); // optimiste
    await couple.setFields({ financeMode: mode });
  }

  async function updateEnabledCurrencies(codes) {
    setEnabledCurrencies(codes);
    if (!coupleId) return;
    await couple.setFields(
      { enabledCurrencies: codes }
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
    await couple.setFields({ debtSettlements: updated });

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

  // Enregistre un virement direct entre les deux membres — un partenaire qui
  // dépanne l'autre en liquidités (ex. plus de VND sur un compte local), sans
  // que ce soit une dépense, un revenu ni un investissement. `fromKey` a
  // envoyé l'argent à `toKey` : useDebtCalculation traite ce mouvement
  // exactement comme une dépense payée à 100% par `fromKey` pour `toKey`,
  // donc il RÉDUIT ce que `toKey` doit à `fromKey` sans solder le compte
  // (contrairement à addDebtSettlement, qui remet tout à zéro sans montant).
  // `arrayUnion` via addItem : deux virements saisis en même temps par les
  // deux membres doivent tous les deux survivre.
  async function addDebtTransfer({ date, amount, currency, fromKey, toKey, note = "" }) {
    if (!coupleId) return;
    await couple.addItem("debtTransfers", {
      id: `xfer_${Date.now()}`,
      date, amount, currency, fromKey, toKey, note,
      createdAt: Date.now(),
      createdBy: user.uid,
    });
  }

  async function removeDebtTransfer(id) {
    if (!coupleId) return;
    await couple.removeItem("debtTransfers", debtTransfers, id);
  }

  // Règlement enregistré comme MOUVEMENT DATÉ, et non plus comme date-butoir.
  //
  // L'ancien `addDebtSettlement` n'écrit qu'une date : le calcul cesse de
  // compter ce qui la précède (`effectiveStart = startDate ?? dernier.date`),
  // sans jamais stocker de montant. Deux impasses en découlaient :
  //
  //   1. En vue Mois/Période, `startDate` est toujours defini, donc le `??`
  //      retient la borne de la periode et les reglements sont IGNORES. Un
  //      bouton y aurait laisse le mois inchange tout en remettant le Total a
  //      zero — donc en effacant aussi les autres mois.
  //   2. Un montant jamais ecrit ne se reconstitue pas : il depend de
  //      transactions qui ont pu changer depuis. Aucun historique chiffre
  //      n'etait donc derivable de l'existant.
  //
  // Un reglement est mathematiquement un virement qui solde le compte : meme
  // accumulateur, meme fenetre de dates, meme liste d'activite. On le range
  // donc dans `debtTransfers` avec un drapeau, ce qui rend la fonctionnalite
  // acquise sans toucher au calcul — et annulable comme un virement.
  //
  // Les anciens reglements-butoir restent honores tels quels (voir le `??` du
  // hook) : aucune reprise de donnees, rien de ce qui existe ne change de sens.
  async function addDebtSettlementEntry({ date, amount, currency, fromKey, toKey, periodLabel = null }) {
    if (!coupleId) return;
    await couple.addItem("debtTransfers", {
      id: `settle_${Date.now()}`,
      date, amount, currency, fromKey, toKey,
      note: "",
      settlement: true,
      periodLabel,
      createdAt: Date.now(),
      createdBy: user.uid,
    });

    if (members.length > 1) {
      sendPushNotification({
        coupleId,
        kind: "debtSettled",
        description: periodLabel || "",
        amount,
        currency,
      });
    }
  }

  async function addRecurring(rule) {
    if (!coupleId) return;
    await couple.addItem("recurringTx", { ...rule, id: `rec_${Date.now()}` });
  }

  async function updateRecurring(id, updates) {
    if (!coupleId) return;
    await couple.patchItem("recurringTx", recurringTx, id, updates);
  }

  async function removeRecurring(id) {
    if (!coupleId) return;
    await couple.removeItem("recurringTx", recurringTx, id);
  }

  async function addBudget(budget) {
    if (!coupleId) return;
    const newBudget = {
      ...budget,
      id: `budget_${Date.now()}`,
      active: budget.active ?? true,
      createdAt: Date.now(),
    };
    await couple.addItem("budgets", newBudget);

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
    await couple.patchItem("budgets", budgets, id, updates);
  }

  async function removeBudget(id) {
    if (!coupleId) return;
    await couple.removeItem("budgets", budgets, id);
  }

  // Crédits / emprunts (immobilier, auto, conso…) — même pattern read-modify-merge
  // que les budgets/assets. Les calculs d'amortissement vivent dans utils/loanMath.js
  // (lecture seule) ; ici on ne stocke que les paramètres du prêt.
  async function addLoan(loan) {
    if (!coupleId) return;
    const newLoan = {
      ...loan,
      id: `loan_${Date.now()}`,
      extraPayments: loan.extraPayments || [],
      createdAt: Date.now(),
    };
    await couple.addItem("loans", newLoan);
  }

  async function updateLoan(id, updates) {
    if (!coupleId) return;
    await couple.patchItem("loans", loans, id, updates);
  }

  async function removeLoan(id) {
    if (!coupleId) return;
    await couple.removeItem("loans", loans, id);
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
    await couple.addItem("goals", newGoal);
  }

  async function updateGoal(id, updates) {
    if (!coupleId) return;
    await couple.patchItem("goals", goals, id, updates);
  }

  async function removeGoal(id) {
    if (!coupleId) return;
    await couple.removeItem("goals", goals, id);
  }

  async function archiveGoal(id) {
    if (!coupleId) return;
    await couple.patchItem("goals", goals, id, { archivedAt: Date.now() });
  }

  async function unarchiveGoal(id) {
    if (!coupleId) return;
    await couple.patchItem("goals", goals, id, { archivedAt: null });
  }

  // Archive / désarchive un budget. L'élément ne bouge pas du tableau : seul
  // `archivedAt` change, et le contexte le range à la lecture. Son historique
  // (budgetHistory, indexé par id de budget) reste donc rattaché à lui — c'est
  // précisément ce que la suppression, elle, orpheline sans retour possible.
  async function archiveBudget(id) {
    if (!coupleId) return;
    await couple.patchItem("budgets", budgets, id, { archivedAt: Date.now() });
  }

  async function unarchiveBudget(id) {
    if (!coupleId) return;
    await couple.patchItem("budgets", budgets, id, { archivedAt: null });
  }

  // Réordonne l'ensemble des budgets (drag & drop dans l'onglet Budget). L'ordre
  // du tableau pilote aussi les 3 budgets affichés dans le widget d'Accueil.
  //
  // L'écran ne connaît que les budgets ACTIFS ; comme on réécrit ici le tableau
  // entier, il faut y remettre les archivés, sinon un simple glisser-déposer
  // viderait l'archive.
  async function reorderBudgets(orderedBudgets) {
    if (!coupleId) return;
    const full = mergeReorder(orderedBudgets, budgets);
    setBudgets(full); // optimiste
    await couple.replaceList("budgets", full);
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
    await couple.setFields({ budgetHistory: next });
  }

  async function setIncomeAccountLinks(map) {
    if (!coupleId) return;
    await couple.setFields({ incomeAccountLinks: map });
  }

  async function addAsset(asset) {
    if (!coupleId) return;
    const newAsset = {
      ...asset,
      id: `asset_${Date.now()}`,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
    };
    await couple.addItem("assets", newAsset);

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
    await couple.patchItem("assets", assets, id, { ...updates, lastUpdated: Date.now() });
  }

  async function removeAsset(id) {
    if (!coupleId) return;
    await couple.removeItem("assets", assets, id);
  }

  // Archive un actif — « Vendu / Clôturé » à l'écran, et le mot compte : à la
  // différence d'un budget archivé (purement cosmétique), un actif archivé
  // FAIT BAISSER LE PATRIMOINE NET du jour où on le fait. Nommer le geste par
  // son effet réel évite de le faire découvrir après coup.
  //
  // `archivedValue` fige la dernière valeur connue pour que la ligne archivée
  // reste lisible : la valorisation d'un actif coté passe par les cours en
  // direct, qu'on cesse justement de demander une fois l'actif archivé.
  async function archiveAsset(id, { archivedValue = null } = {}) {
    if (!coupleId) return;
    await couple.patchItem("assets", assets, id, {
      archivedAt: Date.now(),
      ...(archivedValue != null ? { archivedValue } : {}),
    });
  }

  async function unarchiveAsset(id) {
    if (!coupleId) return;
    await couple.patchItem("assets", assets, id, { archivedAt: null });
  }

  // ── Versements vers des actifs (lot 3) ──────────────────────────────────────
  // Crédite immédiatement un actif à valeur stockée d'un montant (converti dans
  // la devise de l'actif) et alimente son coût investi (plus-value latente). Sert
  // au versement « ponctuel » et est réutilisé par le générateur récurrent.
  async function contributeToAsset(assetId, amount, currency) {
    if (!coupleId || !(amount > 0)) return;
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;
    const assetCur = asset.currency || defaultCurrency;
    const { rate } = await getExchangeRate(currency, assetCur);
    // Sans taux, on n'invente pas de montant : le versement est abandonné
    // (il se refera), plutôt que d'incruster une erreur dans un solde cumulé.
    if (rate === null) return;
    const credit = amount * rate;
    await updateAsset(assetId, {
      value: (asset.value || 0) + credit,
      costBasis: (asset.costBasis || 0) + credit,
    });
  }

  // Enregistre une règle de versement récurrent (quotidien/hebdo/mensuel) vers un
  // actif. Le versement ponctuel ne passe PAS par ici (crédit immédiat).
  async function addAssetContribution(c) {
    if (!coupleId) return;
    const newC = { ...c, id: `contrib_${Date.now()}`, active: c.active ?? true, createdAt: Date.now() };
    await couple.addItem("assetContributions", newC);
  }

  async function removeAssetContribution(id) {
    if (!coupleId) return;
    const applied = { ...assetContributionsApplied };
    delete applied[id];
    // Le versement et sa trace d'application partent ENSEMBLE : les séparer
    // laisserait une entrée orpheline qui bloquerait un futur versement de même
    // identifiant.
    await couple.setFields({
      assetContributions: removeFrom(assetContributions, id),
      assetContributionsApplied: applied,
    });
  }

  // Applique une liste de versements récurrents dus (calculée par le générateur) :
  // crédite chaque actif à valeur stockée + coût investi, et mémorise la période
  // appliquée (idempotence). Les actifs cotés sont ignorés ici (le crédit en
  // quantité au cours du jour est un lot ultérieur).
  async function applyAssetContributions(due) {
    if (!coupleId || !due?.length) return;
    const updatedAssets = assets.map((a) => ({ ...a }));
    const applied = { ...assetContributionsApplied };
    let changed = false;
    for (const { contribution: c, periodKey } of due) {
      const asset = updatedAssets.find((a) => a.id === c.assetId);
      if (!asset) continue;
      const type = ASSET_TYPES.find((ty) => ty.id === asset.typeId);
      if (!type || type.hasApiPrice) continue; // cotés : non gérés ici
      const assetCur = asset.currency || defaultCurrency;
      const { rate } = await getExchangeRate(c.currency, assetCur);
      // Sans taux : on saute ce versement SANS marquer la période comme
      // appliquée, pour qu'il soit retenté au prochain passage.
      if (rate === null) continue;
      const credit = c.amount * rate;
      asset.value = (asset.value || 0) + credit;
      asset.costBasis = (asset.costBasis || 0) + credit;
      asset.lastUpdated = Date.now();
      applied[c.id] = periodKey;
      changed = true;
    }
    if (!changed) return;
    await couple.setFields({ assets: updatedAssets, assetContributionsApplied: applied });
  }

  // Allocation cible : la carte envoie la map complète (toutes les classes de
  // risque), donc un simple merge suffit (les classes remises à 0 restent,
  // ignorées à l'affichage). `profileId` est le profil standard reconnu
  // (prudent/équilibré/…) ou null si la grille a été personnalisée — stocké pour
  // information, l'affichage sait le redéduire de la grille.
  async function updateTargetAllocation(map, profileId = null) {
    if (!coupleId) return;
    setTargetAllocationState(map);
    await couple.setFields(
      { targetAllocation: map, targetAllocationProfile: profileId }
    );
  }

  // Discussion sur un actif : même modèle que les commentaires de transaction
  // (tableau `comments` sur l'objet), mais l'actif vit dans le doc couple → on
  // read-modify-merge le tableau `assets`. Notifie le partenaire (kind "comment").
  async function addAssetComment(assetId, comment) {
    if (!coupleId) return;
    const newComment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
      ...comment,
    };
    const asset = findIn(assets, assetId);
    await couple.patchItem("assets", assets, assetId, {
      comments: [...(asset?.comments || []), newComment],
    });

    if (members.length > 1) {
      sendPushNotification({
        coupleId,
        kind: "comment",
        description: asset?.name || "",
        text: comment.text || "",
        gifUrl: comment.gifUrl || "",
      });
    }
  }

  async function removeAssetComment(assetId, commentId) {
    if (!coupleId) return;
    const asset = findIn(assets, assetId);
    if (!asset) return;
    await couple.patchItem("assets", assets, assetId, {
      comments: removeFrom(asset.comments, commentId),
    });
  }

  async function recordNetWorthSnapshot(totalValue, currency) {
    if (!coupleId) return;
    const today = new Date().toISOString().slice(0, 10);
    // Un seul point par jour : on remplace s'il existe déjà pour aujourd'hui
    const filtered = netWorthHistory.filter((h) => h.date !== today);
    const updated = [...filtered, { date: today, value: totalValue, currency }].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );
    await couple.setFields(
      { netWorthHistory: updated }
    );
  }

  async function updateMemberPhoto(uid, photoURL) {
    if (!coupleId) return;
    const updatedMembers = members.map((m) =>
      m.uid === uid ? { ...m, photoURL } : m
    );
    await couple.setFields(
      { members: updatedMembers, memberUids: updatedMembers.map((m) => m.uid) }
    );
  }

  async function updateMemberName(uid, name) {
    if (!coupleId) return;
    const updatedMembers = members.map((m) =>
      m.uid === uid ? { ...m, name } : m
    );
    await couple.setFields(
      { members: updatedMembers }
    );
  }

  async function updateCoupleName(name) {
    if (!coupleId) return;
    await couple.setFields({ coupleName: name });
  }

  // Rouvre la fenêtre d'invitation pour 7 jours. Le code lui-même ne change
  // pas — c'est l'id du document couple — mais il redevient acceptable par
  // `joinCouple`, qui le referme dès qu'un membre entre.
  async function reopenInvite() {
    if (!coupleId) return;
    const expiry = newInviteExpiry();
    await couple.setFields({ inviteExpiresAt: expiry });
    return expiry;
  }

  async function updateMemberAvatarColor(uid, avatarColor) {
    if (!coupleId) return;
    const updatedMembers = members.map((m) =>
      m.uid === uid ? { ...m, avatarColor } : m
    );
    await couple.setFields(
      { members: updatedMembers }
    );
  }

  async function updateWealthDisplayCurrency(currency) {
    if (!coupleId) return;
    await couple.setFields(
      { wealthDisplayCurrency: currency }
    );
  }

  async function updateDashboardDisplayCurrency(currency) {
    if (!coupleId) return;
    await couple.setFields(
      { dashboardDisplayCurrency: currency }
    );
  }

  async function updateBudgetDisplayCurrency(currency) {
    if (!coupleId) return;
    await couple.setFields(
      { budgetDisplayCurrency: currency }
    );
  }

  async function updateTheme(themeKey) {
    if (!myKey) return;
    setThemePrefs((prev) => ({ ...prev, [myKey]: themeKey }));
    if (coupleId) {
      // Écriture ciblée dans la map (merge imbriqué), pour ne toucher que la clé
      // du membre courant et laisser intact le thème du partenaire.
      await couple.setFields(
        { themePrefs: { [myKey]: themeKey } }
    );
    }
  }

  async function updateLanguage(lang) {
    setLanguageState(lang);
    if (coupleId) {
      await couple.setFields({ language: lang });
    }
  }

  // ── Éléments « surprise » (cadeaux) ─────────────────────────────────────────
  // Une transaction/un actif peut porter `privateTo: <memberKey>` : seul ce
  // membre le voit. On filtre UNIQUEMENT à l'exposition — les tableaux bruts
  // (transactions/assets) restent intacts en interne, sinon les fonctions
  // d'écriture qui font un read-modify-write du tableau complet (updateAsset,
  // addAsset…) effaceraient les éléments cachés du partenaire.
  // `myKey` est calculé plus haut (partagé avec la sélection du thème).
  const isVisibleToMe = (x) => !x?.privateTo || x.privateTo === myKey;
  const visibleTransactions = useMemo(
    () => transactions.filter(isVisibleToMe),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, myKey]
  );
  // Deux filtres se composent ici : le privé (ci-dessus) et l'archivage. Un
  // actif archivé — vendu ou clôturé — sort du patrimoine net, de la
  // répartition, du score de santé et des objectifs, tous branchés sur
  // `assets`. Il reste dans les instantanés des jours où il était détenu :
  // ceux-ci sont figés date par date et jamais recalculés, donc la courbe
  // raconte l'histoire vraie sans qu'on ait rien à faire.
  const visibleAssets = useMemo(
    () => assets.filter((a) => isVisibleToMe(a) && !isArchived(a)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assets, myKey]
  );
  const archivedAssets = useMemo(
    () => partitionArchived(assets.filter(isVisibleToMe)).archived,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assets, myKey]
  );

  // ── Export / import canonique (lot 0 du mode Local) ──────────────────────
  //
  // L'export ne contient QUE ce que le membre courant peut voir : le privé du
  // partenaire en est exclu, comme partout ailleurs. C'est ce qui impose un
  // import NON DESTRUCTIF — remplacer à partir d'un fichier forcément partiel
  // effacerait des données que son auteur n'a jamais vues.
  function exportAllData() {
    const couple = {
      coupleName, members, categories, customTags,
      defaultCurrency, currencyMode, enabledCurrencies, financeMode, language,
      recurringTx, recurringLastGen,
      budgets, budgetHistory, goals, loans,
      assets: visibleAssets, assetContributions, assetContributionsApplied,
      targetAllocation, incomeAccountLinks, netWorthHistory, debtSettlements, debtTransfers,
    };
    return buildExportDocument({
      couple,
      transactions: visibleTransactions,
      memberKey: myKey,
      omittedPrivate:
        transactions.length - visibleTransactions.length +
        (assets.length - visibleAssets.length),
    });
  }

  async function importAllData(raw) {
    if (!coupleId) throw new Error("import_error_no_couple");
    const parsed = parseExportDocument(raw);

    const patch = buildCouplePatch(
      { members, categories, assets, budgets, goals, loans, recurringTx },
      parsed.couple
    );
    // Le document canonique garde un `customTags` à plat — les deux modes de
    // stockage produisent le MÊME fichier, et le par-membre est un détail de
    // rangement d'ICI. On l'aiguille donc vers la liste du membre qui importe,
    // plutôt que vers l'ancien champ commun où il ne serait servi qu'à qui n'a
    // pas encore la sienne (et jamais à l'importateur, qui vient de s'en créer une).
    if (patch.customTags && myKey) {
      patch.customTagsByMember = { [myKey]: patch.customTags };
      delete patch.customTags;
    }
    if (Object.keys(patch).length > 0) {
      await couple.setFields(patch);
    }

    // `memberUids` est réécrit à partir des membres RÉELS du couple, jamais
    // repris du fichier : c'est le champ sur lequel les règles de sécurité
    // fondent l'accès, et une transaction importée avec la liste d'un autre
    // couple serait illisible ici — ou lisible ailleurs.
    const currentMemberUids = members.map((m) => m.uid).filter(Boolean);

    // Firestore plafonne une écriture groupée à 500 opérations.
    const CHUNK = 400;
    for (let i = 0; i < parsed.transactions.length; i += CHUNK) {
      const batch = writeBatch(db);
      for (const tx of parsed.transactions.slice(i, i + CHUNK)) {
        const { id, ...data } = tx;
        batch.set(
          doc(db, "couples", coupleId, "transactions", id),
          { ...data, memberUids: currentMemberUids },
          { merge: true }
        );
      }
      await batch.commit();
    }

    return summarizeImport(parsed);
  }

  const value = {
    transactions: visibleTransactions,
    categories,
    members,
    // Espace « solo » : un seul membre. Tout ce qui suppose deux personnes
    // (suivi des dettes, ventilation par membre, « Payé par / Pour »,
    // propriétaire d'un actif, filtre par membre) se masque là-dessus.
    //
    // Un partenaire INVITÉ MAIS PAS ENCORE INSCRIT compte comme un membre :
    // il porte `uid: null` mais un `memberId` bien réel, et on l'ajoute
    // précisément pour partager des dépenses avec lui avant qu'il n'installe
    // l'app. L'exclure viderait la fonctionnalité de son sens.
    // Tant que le document couple n'est pas arrivé, `members` est vide sans que
    // cela veuille dire quoi que ce soit : on ne conclut PAS au solo. Le doute
    // penche du côté « couple », car les deux erreurs ne coûtent pas la même
    // chose — croire à tort qu'on est seul·e écrit une attribution fausse dans
    // la base, croire à tort qu'on est deux affiche au pire une carte de trop
    // pendant un aller-retour réseau.
    isSolo: coupleLoaded && members.length < 2,
    coupleLoaded,
    coupleName,
    updateCoupleName,
    inviteExpiresAt,
    reopenInvite,
    loading,
    defaultCurrency,
    currencyMode,
    financeMode,
    updateFinanceMode,
    enabledCurrencies,
    updateEnabledCurrencies,
    lastUsedCurrency,
    recurringTx,
    recurringLastGen,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addTransactionComment,
    removeTransactionComment,
    pushPrefs,
    updateMemberPushPrefs,
    navTabs,
    myNavTabs,
    updateMemberNavTabs,
    updateCategories,
    customTags,
    hideAmounts,
    toggleHideAmounts,
    updateCustomTags,
    replaceTagInTransactions,
    updateDefaultCurrency,
    updateCurrencyMode,
    addRecurring,
    updateRecurring,
    removeRecurring,
    budgets: activeBudgets,
    archivedBudgets,
    addBudget,
    updateBudget,
    removeBudget,
    archiveBudget,
    unarchiveBudget,
    reorderBudgets,
    loans,
    addLoan,
    updateLoan,
    removeLoan,
    budgetHistory,
    saveBudgetSnapshots,
    goals: activeGoals,
    archivedGoals,
    addGoal,
    updateGoal,
    removeGoal,
    archiveGoal,
    unarchiveGoal,
    incomeAccountLinks,
    setIncomeAccountLinks,
    assets: visibleAssets,
    archivedAssets,
    addAsset,
    updateAsset,
    removeAsset,
    archiveAsset,
    unarchiveAsset,
    assetContributions,
    assetContributionsApplied,
    contributeToAsset,
    addAssetContribution,
    removeAssetContribution,
    applyAssetContributions,
    targetAllocation,
    updateTargetAllocation,
    addAssetComment,
    removeAssetComment,
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
    debtTransfers,
    addDebtTransfer,
    removeDebtTransfer,
    addDebtSettlementEntry,
    exportAllData,
    importAllData,
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
