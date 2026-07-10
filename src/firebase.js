import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDG6BjMCvUsmMhU05pU2Kt2OxPcFUp7HnM",
  authDomain: "pairwise-12df2.firebaseapp.com",
  projectId: "pairwise-12df2",
  storageBucket: "pairwise-12df2.firebasestorage.app",
  messagingSenderId: "970526442007",
  appId: "1:970526442007:web:ff9e439e78cdb72f615252",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Persistance hors ligne : Firestore garde un cache local (IndexedDB), donc les
// lectures (onSnapshot) et écritures fonctionnent sans réseau et se
// synchronisent à la reconnexion. persistentMultipleTabManager gère plusieurs
// onglets ouverts sans conflit de cache. Si IndexedDB est indisponible
// (navigation privée sur certains navigateurs), on retombe sur le cache mémoire.
let firestore;
try {
  firestore = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
} catch {
  firestore = initializeFirestore(app, {});
}
export const db = firestore;

export const storage = getStorage(app);
export default app;
