import { createContext, useContext, useState, useEffect } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [coupleId, setCoupleId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists()) {
          setCoupleId(userDoc.data().coupleId || null);
        }
      } else {
        setUser(null);
        setCoupleId(null);
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

  const value = {
    user,
    coupleId,
    loading,
    signup,
    login,
    logout,
    joinCouple,
    setCoupleId,
    updateProfilePhoto,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
