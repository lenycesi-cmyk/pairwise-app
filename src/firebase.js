import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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
export const db = getFirestore(app);
export default app;
