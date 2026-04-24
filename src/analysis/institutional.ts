import { DailyPrice, InstitutionalTrade } from "../types/stock";
import { InstitutionalMetrics, InstitutionalSignal } from "../types/analysis";

function streak(values: number[], direction: "buy" | "sell"): number {
  let count = 0;
  for (let i = values.length - 1; i >= 0; i--) {
    if (direction === "buy" && values[i] > 0) count++;
    else if (direction === "sell" && values[i] < 0) count++;
    else break;
  }
  return count;
}

export function computeInstitutionalSeries(
  prices: DailyPrice[],
  trades: InstitutionalTrade[]
): InstitutionalMetrics[] {
  const byDate = new Map<string, DailyPrice>();
  for (const p of prices) byDate.set(p.date, p);

  return trades.map((trade, idx) => {
    const price = byDate.get(trade.date);
    const dailyVolume = price ? price.volume : 0;

    const foreignWindow = trades.slice(0, idx + 1).map((t) => t.foreignInvestor);
    const trustWindow = trades.slice(0, idx + 1).map((t) => t.investmentTrust);
    const totalWindow = trades.slice(0, idx + 1).map((t) => t.total);

    const foreignBuyStreak = streak(foreignWindow, "buy");
    const foreignSellStreak = streak(foreignWindow, "sell");
    const trustBuyStreak = streak(trustWindow, "buy");
    const trustSellStreak = streak(trustWindow, "sell");
    const totalBuyStreak = streak(totalWindow, "buy");
    const totalSellStreak = streak(totalWindow, "sell");

    const foreignTradeVolumeRatio =
      dailyVolume > 0 ? Math.abs(trade.foreignInvestor) / dailyVolume : 0;
    const totalTradeVolumeRatio =
      dailyVolume > 0 ? Math.abs(trade.total) / dailyVolume : 0;

    const isForeignStrongBuy =
      trade.foreignInvestor > 0 && foreignTradeVolumeRatio >= 0.15;
    const isForeignStrongSell =
      trade.foreignInvestor < 0 && foreignTradeVolumeRatio >= 0.15;
    const isTotalStrongBuy =
      trade.total > 0 && totalTradeVolumeRatio >= 0.2;
    const isTotalStrongSell =
      trade.total < 0 && totalTradeVolumeRatio >= 0.2;

    const signals: InstitutionalSignal[] = [];

    if (trade.foreignInvestor > 0 && foreignBuyStreak >= 3) signals.push("FOREIGN_BUYING");
    if (trade.foreignInvestor < 0 && foreignSellStreak >= 3) signals.push("FOREIGN_SELLING");
    if (trade.investmentTrust > 0 && trustBuyStreak >= 3) signals.push("TRUST_BUYING");
    if (trade.investmentTrust < 0 && trustSellStreak >= 3) signals.push("TRUST_SELLING");

    const allBuy =
      trade.foreignInvestor > 0 &&
      trade.investmentTrust > 0 &&
      trade.dealer > 0;
    const allSell =
      trade.foreignInvestor < 0 &&
      trade.investmentTrust < 0 &&
      trade.dealer < 0;

    if (allBuy) signals.push("ALL_INSTITUTIONS_BUYING");
    if (allSell) signals.push("ALL_INSTITUTIONS_SELLING");

    if (trade.foreignInvestor < 0 && trade.investmentTrust > 0) {
      signals.push("FOREIGN_SELL_TRUST_BUY");
    }

    const signs = [
      Math.sign(trade.foreignInvestor),
      Math.sign(trade.investmentTrust),
      Math.sign(trade.dealer),
    ].filter((s) => s !== 0);
    const divergent =
      signs.length >= 2 &&
      signs.some((s) => s > 0) &&
      signs.some((s) => s < 0);

    if (divergent && signals.length === 0) {
      signals.push("INSTITUTIONAL_DIVERGENCE");
    }

    if (signals.length === 0) {
      signals.push("INSTITUTIONAL_NEUTRAL");
    }

    return {
      date: trade.date,
      foreignInvestor: trade.foreignInvestor,
      investmentTrust: trade.investmentTrust,
      dealer: trade.dealer,
      total: trade.total,
      foreignBuyStreak,
      foreignSellStreak,
      trustBuyStreak,
      trustSellStreak,
      totalBuyStreak,
      totalSellStreak,
      foreignTradeVolumeRatio,
      totalTradeVolumeRatio,
      isForeignStrongBuy,
      isForeignStrongSell,
      isTotalStrongBuy,
      isTotalStrongSell,
      signals,
    };
  });
}

export function sumRecent(
  trades: InstitutionalTrade[],
  key: "foreignInvestor" | "investmentTrust" | "dealer" | "total",
  days: number
): number {
  const slice = trades.slice(-days);
  return slice.reduce((acc, t) => acc + t[key], 0);
}

export function describeInstitutionalSignals(
  signals: InstitutionalSignal[]
): string {
  const map: Record<InstitutionalSignal, string> = {
    FOREIGN_BUYING: "外資連續買超",
    FOREIGN_SELLING: "外資連續賣超",
    TRUST_BUYING: "投信連續買超",
    TRUST_SELLING: "投信連續賣超",
    ALL_INSTITUTIONS_BUYING: "三大法人同步買超",
    ALL_INSTITUTIONS_SELLING: "三大法人同步賣超",
    FOREIGN_SELL_TRUST_BUY: "外資賣、投信買（籌碼移轉）",
    INSTITUTIONAL_DIVERGENCE: "法人方向分歧",
    INSTITUTIONAL_NEUTRAL: "法人中性",
  };
  return signals.map((s) => map[s]).join("、");
}
