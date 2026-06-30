import { useState, useCallback } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useAuth } from "../context/AuthContext";

const functions = getFunctions(undefined, "europe-west1");

export function usePlaid() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createLinkToken = useCallback(async (coupleId, assetId) => {
    setLoading(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, "createLinkToken");
      const res = await fn({ coupleId, assetId, language: "fr" });
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

  return { createLinkToken, exchangeToken, syncBalance, disconnectBank, loading, error };
}
