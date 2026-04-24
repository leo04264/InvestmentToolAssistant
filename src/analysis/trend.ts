import { DailyPrice } from "../types/stock";
import {
  CandleMetrics,
  InstitutionalMetrics,
  TrendAnalysis,
  TrendStage,
  VolumeMetrics,
} from "../types/analysis";

function movingAverage(prices: DailyPrice[], period: number): number {
  if (prices.length === 0) return 0;
  const slice = prices.slice(-period);
  const sum = slice.reduce((acc, p) => acc + p.close, 0);
  return sum / slice.length;
}

export function analyzeTrend(
  prices: DailyPrice[],
  candles: CandleMetrics[],
  volumes: VolumeMetrics[],
  institutional: InstitutionalMetrics[]
): TrendAnalysis {
  const reasons: string[] = [];

  const ma5 = movingAverage(prices, 5);
  const ma10 = movingAverage(prices, 10);
  const ma20 = movingAverage(prices, 20);
  const ma60 = movingAverage(prices, 60);

  const last = prices[prices.length - 1];
  const slice60 = prices.slice(-60);
  const high60 = Math.max(...slice60.map((p) => p.high));
  const low60 = Math.min(...slice60.map((p) => p.low));
  const range60 = Math.max(high60 - low60, 1e-9);

  const position60d = (last.close - low60) / range60;
  const pctFrom60dHigh = (last.close - high60) / high60;
  const pctFrom60dLow = (last.close - low60) / low60;

  const recent20 = prices.slice(-20);
  const priorHigh20 = Math.max(
    ...prices.slice(-40, -1).map((p) => p.high)
  );
  const breakout20 = last.close > priorHigh20;

  const recentCandles = candles.slice(-10);
  const longUpperCount = recentCandles.filter((c) =>
    c.signals.includes("LONG_UPPER_SHADOW")
  ).length;

  const recentVolumes = volumes.slice(-10);
  const avgRatio20 =
    recentVolumes.reduce((acc, v) => acc + v.volumeRatio20, 0) /
    Math.max(recentVolumes.length, 1);

  const recentInst = institutional.slice(-10);
  const foreignNet = recentInst.reduce((acc, i) => acc + i.foreignInvestor, 0);
  const totalNet = recentInst.reduce((acc, i) => acc + i.total, 0);

  const maBull = ma5 > ma10 && ma10 > ma20 && ma20 > ma60;
  const maBear = ma5 < ma10 && ma10 < ma20 && ma20 < ma60;

  let stage: TrendStage = "UNKNOWN";

  if (maBull && breakout20 && position60d > 0.8) {
    stage = "MAIN_UPTREND";
    reasons.push("均線多頭排列");
    reasons.push("突破近 40 日高");
    reasons.push("股價位於 60 日區間上緣");
  } else if (
    pctFrom60dHigh < -0.1 &&
    last.close < ma20 &&
    last.close >= ma60 * 0.97
  ) {
    stage = "PULLBACK";
    reasons.push("自 60 日高點回落超過 10%");
    reasons.push("已跌破 20 日均線但尚未跌破季線");
  } else if (
    maBear &&
    foreignNet < 0 &&
    position60d < 0.3
  ) {
    stage = "DOWNTREND";
    reasons.push("均線空頭排列");
    reasons.push("外資近 10 日合計賣超");
    reasons.push("股價位於 60 日區間下緣");
  } else if (
    position60d > 0.6 &&
    longUpperCount >= 2 &&
    avgRatio20 >= 1.2 &&
    (totalNet < 0 || foreignNet < 0)
  ) {
    stage = "HIGH_VOLATILITY";
    reasons.push("股價位於相對高檔");
    reasons.push("近 10 日多次出現長上影");
    reasons.push("法人轉為淨賣超");
  } else if (
    position60d < 0.35 &&
    Math.abs(last.close - ma20) / ma20 < 0.05 &&
    avgRatio20 < 1
  ) {
    stage = "BASE_BUILDING";
    reasons.push("股價位於 60 日區間下半部");
    reasons.push("量能低於 20 日均量");
    reasons.push("橫向整理型態");
  } else if (breakout20 && ma5 > ma20 && avgRatio20 > 1) {
    stage = "EARLY_UPTREND";
    reasons.push("突破近 20 日整理區");
    reasons.push("5 日均線上穿 20 日均線");
    reasons.push("成交量高於 20 日均量");
  } else {
    stage = "UNKNOWN";
    reasons.push("訊號混雜，建議等待更明確趨勢");
  }

  return {
    stage,
    reasons,
    ma5,
    ma10,
    ma20,
    ma60,
    position60d,
    pctFrom60dHigh,
    pctFrom60dLow,
  };
}

export function describeTrendStage(stage: TrendStage): string {
  const map: Record<TrendStage, string> = {
    BASE_BUILDING: "低檔築底",
    EARLY_UPTREND: "初升段",
    MAIN_UPTREND: "主升段",
    HIGH_VOLATILITY: "高檔震盪",
    PULLBACK: "回檔修正",
    DOWNTREND: "空頭趨勢",
    UNKNOWN: "趨勢不明",
  };
  return map[stage];
}
