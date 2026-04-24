import { DailyPrice } from "../types/stock";
import { VolumeMetrics, VolumeSignal } from "../types/analysis";

function average(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

export function computeVolumeSeries(prices: DailyPrice[]): VolumeMetrics[] {
  return prices.map((price, idx) => {
    const start5 = Math.max(0, idx - 4);
    const start20 = Math.max(0, idx - 19);

    const window5 = prices.slice(start5, idx + 1).map((p) => p.volume);
    const window20 = prices.slice(start20, idx + 1).map((p) => p.volume);

    const avgVolume5 = average(window5);
    const avgVolume20 = average(window20);

    const volumeRatio5 = avgVolume5 > 0 ? price.volume / avgVolume5 : 0;
    const volumeRatio20 = avgVolume20 > 0 ? price.volume / avgVolume20 : 0;

    const isHighVolume = volumeRatio20 >= 1.5;
    const isExplosiveVolume = volumeRatio20 >= 2.0;
    const isLowVolume = volumeRatio20 <= 0.7 && volumeRatio20 > 0;

    const signals: VolumeSignal[] = [];

    const prevClose = idx > 0 ? prices[idx - 1].close : price.close;
    const priceUp = price.close > prevClose;
    const priceDown = price.close < prevClose;

    if (isExplosiveVolume) {
      signals.push("VOLUME_EXPLOSION");
    } else if (isHighVolume) {
      signals.push("VOLUME_EXPANSION");
    } else if (isLowVolume) {
      signals.push("VOLUME_CONTRACTION");
    }

    if (priceDown && isLowVolume) {
      signals.push("HEALTHY_PULLBACK");
    }

    const body = Math.abs(price.close - price.open);
    const range = Math.max(price.high - price.low, 1e-9);
    const upperShadow = price.high - Math.max(price.open, price.close);

    if (isExplosiveVolume && (upperShadow / range >= 0.4 || body / range < 0.2)) {
      signals.push("DISTRIBUTION_VOLUME");
    }

    if (priceUp && isHighVolume && body / range >= 0.5) {
      signals.push("ACCUMULATION_VOLUME");
    }

    if (signals.length === 0) {
      signals.push("UNKNOWN");
    }

    return {
      date: price.date,
      volume: price.volume,
      avgVolume5,
      avgVolume20,
      volumeRatio5,
      volumeRatio20,
      isHighVolume,
      isExplosiveVolume,
      isLowVolume,
      signals,
    };
  });
}

export function describeVolumeSignals(signals: VolumeSignal[]): string {
  const map: Record<VolumeSignal, string> = {
    VOLUME_EXPANSION: "放量（買賣力道增強）",
    VOLUME_EXPLOSION: "爆量（換手活躍，需觀察是買盤或賣壓）",
    VOLUME_CONTRACTION: "量縮（多空暫時休兵）",
    HEALTHY_PULLBACK: "量縮回檔（健康整理）",
    DISTRIBUTION_VOLUME: "爆量不漲 / 上影（疑似出貨）",
    ACCUMULATION_VOLUME: "放量上漲收實體（疑似買盤進駐）",
    UNKNOWN: "成交量無顯著訊號",
  };
  return signals.map((s) => map[s]).join("、");
}
