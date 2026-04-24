import { DailyPrice } from "../types/stock";
import { CandleMetrics, CandleSignal } from "../types/analysis";

const EPS = 1e-9;

export function computeCandleMetrics(price: DailyPrice): CandleMetrics {
  const body = Math.abs(price.close - price.open);
  const upperShadow = price.high - Math.max(price.open, price.close);
  const lowerShadow = Math.min(price.open, price.close) - price.low;
  const fullRange = Math.max(price.high - price.low, EPS);

  const bodyRatio = body / fullRange;
  const upperShadowRatio = upperShadow / fullRange;
  const lowerShadowRatio = lowerShadow / fullRange;

  const isRedCandle = price.close > price.open;
  const isBlackCandle = price.close < price.open;
  const isDojiLike = bodyRatio < 0.2;

  const signals: CandleSignal[] = [];

  if (upperShadowRatio >= 0.4 && upperShadow > body) {
    signals.push("LONG_UPPER_SHADOW");
  }
  if (lowerShadowRatio >= 0.4 && lowerShadow > body) {
    signals.push("LONG_LOWER_SHADOW");
  }
  if (
    isRedCandle &&
    bodyRatio >= 0.6 &&
    price.close >= price.high - fullRange * 0.15
  ) {
    signals.push("STRONG_RED_CANDLE");
  }
  if (
    isBlackCandle &&
    bodyRatio >= 0.6 &&
    price.close <= price.low + fullRange * 0.15
  ) {
    signals.push("STRONG_BLACK_CANDLE");
  }
  if (isDojiLike) {
    signals.push("DOJI");
  }

  if (signals.length === 0) {
    signals.push("UNKNOWN");
  }

  return {
    date: price.date,
    open: price.open,
    high: price.high,
    low: price.low,
    close: price.close,
    body,
    upperShadow,
    lowerShadow,
    fullRange,
    bodyRatio,
    upperShadowRatio,
    lowerShadowRatio,
    isRedCandle,
    isBlackCandle,
    isDojiLike,
    signals,
  };
}

export function computeCandleSeries(prices: DailyPrice[]): CandleMetrics[] {
  return prices.map(computeCandleMetrics);
}

export function describeCandleSignals(signals: CandleSignal[]): string {
  const map: Record<CandleSignal, string> = {
    LONG_UPPER_SHADOW: "長上影線（高檔出現代表上方賣壓重，低檔出現代表反彈被壓回）",
    LONG_LOWER_SHADOW: "長下影線（支撐區出現代表低檔有承接，偏向止跌訊號）",
    STRONG_RED_CANDLE: "強紅 K（買盤積極，若搭配放量與法人買超為攻擊訊號）",
    STRONG_BLACK_CANDLE: "強黑 K（賣壓積極，若搭配放量與法人賣超為轉弱訊號）",
    DOJI: "十字線（多空拉鋸，需等後續方向確認）",
    HIGH_VOLUME_BLACK_CANDLE: "放量黑 K（賣壓明顯）",
    HIGH_VOLUME_RED_CANDLE: "放量紅 K（買盤積極）",
    BREAKOUT_CANDLE: "突破 K 棒（有效突破壓力）",
    BREAKDOWN_CANDLE: "跌破 K 棒（跌破重要支撐）",
    REVERSAL_WARNING: "反轉警訊（需等隔日確認）",
    SUPPORT_REBOUND: "支撐反彈",
    UNKNOWN: "無明顯 K 線訊號",
  };
  return signals.map((s) => map[s]).join("、");
}
