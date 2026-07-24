import { useState, useCallback } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions(undefined, "europe-west1");

export function usePlaid() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createLinkToken = useCallback(async (coupleId, assetId, update = false) => {
    setLoading(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, "createLinkToken");
      const res = await fn({ coupleId, assetId, language: "fr", update });
      return res.data.linkToken;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const exchangeToken = useCallback(async (coupleId, assetId, publicToken, accountId, institutionName) => {
    setLoading(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, "exchangeToken");
      const res = await fn({ coupleId, assetId, publicToken, accountId, institutionName });
      return res.data;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Enable Banking (flux REDIRECT, pas de popup) ────────────────────────
  // Étape 1 : createLinkToken renvoie une URL vers la banque ; on redirige le
  // navigateur dessus. La banque revient ensuite sur ENABLE_BANKING_REDIRECT_URL
  // (…/bank-callback?code=…&state=…), traité par BankCallbackHandler.
  const startEnableBanking = useCallback(async (coupleId, assetId, aspspName, aspspCountry = "FR") => {
    setLoading(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, "createLinkToken");
      const res = await fn({ provider: "enableBanking", coupleId, assetId, aspspName, aspspCountry });
      const { url } = res.data;
      if (!url) throw new Error("No auth URL returned");
      window.location.href = url; // quitte l'app vers la page de consentement bancaire
      return res.data;
    } catch (e) {
      setError(e.message);
      setLoading(false);
      throw e;
    }
  }, []);

  // Étape 2 : au retour, on échange le `code` contre une session + le solde. Le
  // back-end écrit la connexion et met l'asset à jour (admin SDK) ; onSnapshot
  // reflète l'état, rien à écrire côté client ici.
  const finishEnableBanking = useCallback(async (coupleId, assetId, code, accountUid) => {
    setLoading(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, "exchangeToken");
      const res = await fn({ provider: "enableBanking", coupleId, assetId, code, accountUid });
      return res.data;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const syncBalance = useCallback(async (coupleId, assetId) => {
    setLoading(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, "syncBalance");
      const res = await fn({ coupleId, assetId });
      return res.data;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnectBank = useCallback(async (coupleId, assetId) => {
    setLoading(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, "disconnectBank");
      const res = await fn({ coupleId, assetId });
      return res.data;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { createLinkToken, exchangeToken, startEnableBanking, finishEnableBanking, syncBalance, disconnectBank, loading, error };
}
