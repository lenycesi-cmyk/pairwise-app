import { useState, useEffect, useMemo } from "react";
import { ASSET_TYPES } from "../data/assetTypes";
import { getCryptoPrice, getStockPrice } from "../utils/assetPrices";
import { useFinance } from "../context/FinanceContext";
import { useExchangeRates } from "./useExchangeRates";
import { getMemberKey } from "../utils/members";

/**
 * Shared hook: computes net worth totals (including live API prices for
 * crypto/stocks) in any display currency. Used by WealthScreen and the
 * Dashboard net-worth widget so they both show consistent values.
 */
export function useNetWorth(displayCurrency) {
  const { assets, members } = useFinance();
  const { convert, loading: ratesLoading } = useExchangeRates(displayCurrency);
  const [livePrices, setLivePrices] = useState({});

  useEffect(() => {
    if (ratesLoading || assets.length === 0) return;

    let cancelled = false;
    (async () => {
      const updates = {};
      for (const asset of assets) {
        const type = ASSET_TYPES.find((t) => t.id === asset.typeId);
        if (!type?.hasApiPrice || !asset.apiId) continue;
        if (type.priceSource === "crypto") {
          const { price, success } = await getCryptoPrice(
            asset.apiId,
            displayCurrency.toLowerCase()
          );
          if (success) updates[asset.id] = price * (asset.quantity || 1);
        } else if (type.priceSource === "stocks") {
          const { price, success } = await getStockPrice(asset.apiId);
          if (success) {
            updates[asset.id] = convert(price, "USD", displayCurrency) * (asset.quantity || 1);
          }
        }
      }
      if (!cancelled) setLivePrices(updates);
    })();

    return () => { cancelled = true; };
  }, [assets.length, ratesLoading, displayCurrency]);

  function getAssetValue(asset) {
    if (livePrices[asset.id] !== undefined) return livePrices[asset.id];
    return convert(asset.value ?? 0, asset.currency || displayCurrency, displayCurrency);
  }

  function getMemberShare(asset, memberUid) {
    const total = getAssetValue(asset);
    if (asset.ownership === memberUid) return total;
    if (asset.ownership === "shared") {
      const isFirst = getMemberKey(members[0]) === memberUid;
      const pct = isFirst ? (asset.sharePct ?? 50) : 100 - (asset.sharePct ?? 50);
      return total * (pct / 100);
    }
    return 0;
  }

  const netWorth = useMemo(() => {
    let total = 0;
    for (const asset of assets) {
      const type = ASSET_TYPES.find((t) => t.id === asset.typeId);
      const val = getAssetValue(asset);
      total += type?.isLiability ? -Math.abs(val) : val;
    }
    return total;
  }, [assets, livePrices, displayCurrency]);

  const netWorthByMember = useMemo(() => {
    const result = {};
    for (const m of members) result[getMemberKey(m)] = 0;
    for (const asset of assets) {
      const type = ASSET_TYPES.find((t) => t.id === asset.typeId);
      const sign = type?.isLiability ? -1 : 1;
      for (const m of members) {
        const key = getMemberKey(m);
        result[key] = (result[key] || 0) + sign * Math.abs(getMemberShare(asset, key));
      }
    }
    return result;
  }, [assets, livePrices, displayCurrency, members]);

  return { netWorth, netWorthByMember, getAssetValue, livePrices };
}
