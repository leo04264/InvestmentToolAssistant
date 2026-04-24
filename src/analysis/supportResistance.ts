import { DailyPrice } from "../types/stock";
import {
  CandleMetrics,
  SupportResistanceLevel,
  VolumeMetrics,
} from "../types/analysis";

type LevelCandidate = {
  price: number;
  type: "SUPPORT" | "RESISTANCE";
  weight: number;
  reasons: string[];
};

const MERGE_PCT = 0.015;

function mergeLevels(
  candidates: LevelCandidate[]
): SupportResistanceLevel[] {
  candidates.sort((a, b) => a.price - b.price);
  const merged: LevelCandidate[] = [];

  for (const c of candidates) {
    const existing = merged.find(
      (m) =>
        m.type === c.type &&
        Math.abs(m.price - c.price) / Math.max(m.price, 1e-9) <= MERGE_PCT
    );
    if (existing) {
      existing.price =
        (existing.price * existing.weight + c.price * c.weight) /
        (existing.weight + c.weight);
      existing.weight += c.weight;
      for (const r of c.reasons) {
        if (!existing.reasons.includes(r)) existing.reasons.push(r);
      }
    } else {
      merged.push({
        price: c.price,
        type: c.type,
        weight: c.weight,
        reasons: [...c.reasons],
      });
    }
  }

  return merged.map((m) => ({
    price: Number(m.price.toFixed(2)),
    type: m.type,
    strength:
      m.weight >= 4 ? "STRONG" : m.weight >= 2 ? "MEDIUM" : "WEAK",
    reason: m.reasons.join("；"),
  }));
}

export function findSupportResistance(
  prices: DailyPrice[],
  candles: CandleMetrics[],
  volumes: VolumeMetrics[]
): SupportResistanceLevel[] {
  const candidates: LevelCandidate[] = [];
  const last = prices[prices.length - 1];

  const slice60 = prices.slice(-60);
  const high60 = Math.max(...slice60.map((p) => p.high));
  const low60 = Math.min(...slice60.map((p) => p.low));

  candidates.push({
    price: high60,
    type: "RESISTANCE",
    weight: 2,
    reasons: ["近 60 日最高點"],
  });
  candidates.push({
    price: low60,
    type: "SUPPORT",
    weight: 2,
    reasons: ["近 60 日最低點"],
  });

  const slice20 = prices.slice(-20);
  candidates.push({
    price: Math.max(...slice20.map((p) => p.high)),
    type: "RESISTANCE",
    weight: 1,
    reasons: ["近 20 日高點"],
  });
  candidates.push({
    price: Math.min(...slice20.map((p) => p.low)),
    type: "SUPPORT",
    weight: 1,
    reasons: ["近 20 日低點"],
  });

  for (let i = Math.max(0, candles.length - 60); i < candles.length; i++) {
    const c = candles[i];
    const v = volumes[i];
    const highVol = v && v.isHighVolume;

    if (c.signals.includes("LONG_UPPER_SHADOW")) {
      candidates.push({
        price: c.high,
        type: "RESISTANCE",
        weight: highVol ? 2 : 1,
        reasons: ["長上影線高點"],
      });
    }
    if (c.signals.includes("LONG_LOWER_SHADOW")) {
      candidates.push({
        price: c.low,
        type: "SUPPORT",
        weight: highVol ? 2 : 1,
        reasons: ["長下影線低點"],
      });
    }
    if (c.signals.includes("STRONG_BLACK_CANDLE") && highVol) {
      candidates.push({
        price: c.open,
        type: "RESISTANCE",
        weight: 2,
        reasons: ["爆量黑 K 開盤價（前套牢區）"],
      });
    }
    if (c.signals.includes("STRONG_RED_CANDLE") && highVol) {
      candidates.push({
        price: c.open,
        type: "SUPPORT",
        weight: 2,
        reasons: ["大量紅 K 起漲點"],
      });
    }
  }

  const ma5 = average(slice20.slice(-5).map((p) => p.close));
  const ma10 = average(slice20.slice(-10).map((p) => p.close));
  const ma20 = average(slice20.map((p) => p.close));
  const ma60 = average(slice60.map((p) => p.close));

  const maPairs: { price: number; label: string }[] = [
    { price: ma5, label: "5 日均線" },
    { price: ma10, label: "10 日均線" },
    { price: ma20, label: "20 日均線" },
    { price: ma60, label: "60 日均線" },
  ];

  for (const m of maPairs) {
    if (m.price > 0 && m.price < last.close) {
      candidates.push({
        price: m.price,
        type: "SUPPORT",
        weight: 1,
        reasons: [`${m.label}支撐`],
      });
    } else if (m.price > 0 && m.price > last.close) {
      candidates.push({
        price: m.price,
        type: "RESISTANCE",
        weight: 1,
        reasons: [`${m.label}反壓`],
      });
    }
  }

  const merged = mergeLevels(candidates);

  const supports = merged
    .filter((l) => l.type === "SUPPORT" && l.price < last.close)
    .sort((a, b) => b.price - a.price)
    .slice(0, 4);
  const resistances = merged
    .filter((l) => l.type === "RESISTANCE" && l.price > last.close)
    .sort((a, b) => a.price - b.price)
    .slice(0, 4);

  return [...supports, ...resistances];
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
