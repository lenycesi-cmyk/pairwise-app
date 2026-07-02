import { createContext, useContext, useState, useEffect } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { doc, setDoc, getDoc, deleteDoc, getDocs, collection, writeBatch } from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [coupleId, setCoupleId] = useState(null);
  // Only ever explicitly false right after a fresh couple create/join (see
  // CoupleSetupScreen) — missing/undefined defaults to true so existing
  // users (who predate this field) never get routed back into onboarding.
  const [onboardingComplete, setOnboardingComplete] = useState(true);
  // Per-user, per-tab "have they seen the first-visit hint" flags, e.g.
  // { dashboard: true, budget: true } — used by TabHint to show a one-time
  // contextual tip the first time each tab is opened after onboarding.
  const [seenHints, setSeenHints] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setCoupleId(data.coupleId || null);
          setOnboardingComplete(data.onboardingComplete !== false);
          setSeenHints(data.seenHints || {});
        }
      } else {
        setUser(null);
        setCoupleId(null);
        setOnboardingComplete(true);
        setSeenHints({});
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function signup(email, password, displayName) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    await setDoc(doc(db, "users", cred.user.uid), {
      email,
      displayName,
      createdAt: Date.now(),
      coupleId: null,
    });
    return cred.user;
  }

  async function login(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  }

  async function logout() {
    await signOut(auth);
  }

  async function joinCouple(newCoupleId) {
    await setDoc(
      doc(db, "users", user.uid),
      { coupleId: newCoupleId },
      { merge: true }
    );
    setCoupleId(newCoupleId);
  }

  async function updateProfilePhoto(photoURL) {
    await updateProfile(auth.currentUser, { photoURL });
    await setDoc(doc(db, "users", user.uid), { photoURL }, { merge: true });
    // Force le re-render avec le nouvel objet user (photoURL à jour)
    setUser({ ...auth.currentUser });
  }

  async function deleteAccount(password, members) {
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(auth.currentUser, credential);

    const uid = user.uid;
    const batch = writeBatch(db);

    // Remove this member from the couple's members list. A placeholder
    // partner (uid: null, invited but never joined) doesn't count as
    // "someone remaining" — deleting the only real account should still
    // clean up the whole couple rather than leave an orphaned space only a
    // placeholder could ever claim.
    const remainingMembers = (members || []).filter((m) => m.uid !== uid);
    const remainingRealMembers = remainingMembers.filter((m) => m.uid);
    if (remainingRealMembers.length === 0 && coupleId) {
      // Last member — delete all couple data
      const txSnap = await getDocs(collection(db, "couples", coupleId, "transactions"));
      txSnap.forEach((d) => batch.delete(d.ref));
      const connSnap = await getDocs(collection(db, "couples", coupleId, "bankConnections"));
      connSnap.forEach((d) => batch.delete(d.ref));
      batch.delete(doc(db, "couples", coupleId));
    } else if (coupleId) {
      // Other member remains — just remove this user from members array
      batch.set(doc(db, "couples", coupleId), { members: remainingMembers }, { merge: true });
    }

    // Delete user doc
    batch.delete(doc(db, "users", uid));
    await batch.commit();

    // Delete Firebase Auth account (must be last)
    await deleteUser(auth.currentUser);
  }

  async function updateDisplayName(newName) {
    await updateProfile(auth.currentUser, { displayName: newName });
    await setDoc(doc(db, "users", user.uid), { displayName: newName }, { merge: true });
    setUser({ ...auth.currentUser });
  }

  async function completeOnboarding() {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid), { onboardingComplete: true }, { merge: true });
    setOnboardingComplete(true);
  }

  async function markHintSeen(key) {
    if (!user || seenHints[key]) return;
    const updated = { ...seenHints, [key]: true };
    setSeenHints(updated);
    await setDoc(doc(db, "users", user.uid), { seenHints: updated }, { merge: true });
  }

  async function resetHints() {
    if (!user) return;
    setSeenHints({});
    await setDoc(doc(db, "users", user.uid), { seenHints: {} }, { merge: true });
  }

  const value = {
    user,
    coupleId,
    onboardingComplete,
    setOnboardingComplete,
    completeOnboarding,
    seenHints,
    markHintSeen,
    resetHints,
    loading,
    signup,
    login,
    logout,
    joinCouple,
    setCoupleId,
    updateProfilePhoto,
    updateDisplayName,
    deleteAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
