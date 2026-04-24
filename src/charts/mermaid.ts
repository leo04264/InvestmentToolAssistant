import {
  FundamentalScore,
  InstitutionalMetrics,
  VolumeMetrics,
} from "../types/analysis";
import { DailyPrice } from "../types/stock";

const RECENT = 30;

function fence(content: string): string {
  return ["```mermaid", content, "```"].join("\n");
}

function shortDate(d: string): string {
  const parts = d.split("-");
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : d;
}

function pickRecent<T>(arr: T[], n = RECENT): T[] {
  return arr.slice(-n);
}

export function priceLineChart(prices: DailyPrice[]): string {
  const recent = pickRecent(prices);
  if (recent.length < 2) return "";
  const dates = recent.map((p) => `"${shortDate(p.date)}"`).join(", ");
  const closes = recent.map((p) => p.close.toFixed(2)).join(", ");
  const lo = Math.min(...recent.map((p) => p.low));
  const hi = Math.max(...recent.map((p) => p.high));
  const pad = (hi - lo) * 0.05 || 1;
  const body = [
    "xychart-beta",
    `  title "近 ${recent.length} 日收盤價"`,
    `  x-axis [${dates}]`,
    `  y-axis "Price" ${(lo - pad).toFixed(2)} --> ${(hi + pad).toFixed(2)}`,
    `  line [${closes}]`,
  ].join("\n");
  return fence(body);
}

export function volumeBarChart(
  prices: DailyPrice[],
  volumes: VolumeMetrics[]
): string {
  const n = Math.min(prices.length, volumes.length, RECENT);
  const recentP = prices.slice(-n);
  const recentV = volumes.slice(-n);
  if (recentP.length === 0) return "";
  const dates = recentP.map((p) => `"${shortDate(p.date)}"`).join(", ");
  const vols = recentP.map((p) => Math.round(p.volume)).join(", ");
  const ma20 = recentV.map((v) => Math.round(v.avgVolume20)).join(", ");
  const max = Math.max(...recentP.map((p) => p.volume), ...recentV.map((v) => v.avgVolume20));
  const body = [
    "xychart-beta",
    `  title "近 ${recentP.length} 日成交量（張） vs 20 日均量"`,
    `  x-axis [${dates}]`,
    `  y-axis "Volume" 0 --> ${Math.round(max * 1.1)}`,
    `  bar [${vols}]`,
    `  line [${ma20}]`,
  ].join("\n");
  return fence(body);
}

export function foreignNetChart(institutional: InstitutionalMetrics[]): string {
  const recent = pickRecent(institutional);
  if (recent.length === 0) return "";
  const dates = recent.map((i) => `"${shortDate(i.date)}"`).join(", ");
  const values = recent.map((i) => Math.round(i.foreignInvestor)).join(", ");
  const minV = Math.min(...recent.map((i) => i.foreignInvestor));
  const maxV = Math.max(...recent.map((i) => i.foreignInvestor));
  const span = Math.max(Math.abs(minV), Math.abs(maxV), 1);
  const body = [
    "xychart-beta",
    `  title "近 ${recent.length} 日外資買賣超（張）"`,
    `  x-axis [${dates}]`,
    `  y-axis "Net Buy" ${Math.round(-span * 1.1)} --> ${Math.round(span * 1.1)}`,
    `  bar [${values}]`,
  ].join("\n");
  return fence(body);
}

export function institutionalCumulativeChart(
  institutional: InstitutionalMetrics[]
): string {
  const recent = pickRecent(institutional);
  if (recent.length === 0) return "";
  const dates = recent.map((i) => `"${shortDate(i.date)}"`).join(", ");

  let foreignCum = 0;
  let trustCum = 0;
  let dealerCum = 0;
  const foreignArr: number[] = [];
  const trustArr: number[] = [];
  const dealerArr: number[] = [];
  for (const i of recent) {
    foreignCum += i.foreignInvestor;
    trustCum += i.investmentTrust;
    dealerCum += i.dealer;
    foreignArr.push(Math.round(foreignCum));
    trustArr.push(Math.round(trustCum));
    dealerArr.push(Math.round(dealerCum));
  }

  const all = [...foreignArr, ...trustArr, ...dealerArr];
  const minV = Math.min(...all);
  const maxV = Math.max(...all);
  const pad = Math.max((maxV - minV) * 0.1, 1);

  const body = [
    "xychart-beta",
    `  title "近 ${recent.length} 日三大法人累積買賣超（張）"`,
    `  x-axis [${dates}]`,
    `  y-axis "Cumulative" ${Math.round(minV - pad)} --> ${Math.round(maxV + pad)}`,
    `  line [${foreignArr.join(", ")}]`,
    `  line [${trustArr.join(", ")}]`,
    `  line [${dealerArr.join(", ")}]`,
  ].join("\n");
  return fence(body);
}

export function fundamentalScoreChart(score?: FundamentalScore): string {
  if (!score) return "";
  const body = [
    "xychart-beta",
    `  title "基本面五項評分（總分 ${score.totalScore.toFixed(1)}）"`,
    `  x-axis ["營收", "獲利", "估值", "股利", "成長"]`,
    `  y-axis "Score" 0 --> 100`,
    `  bar [${[
      score.revenueScore,
      score.profitabilityScore,
      score.valuationScore,
      score.dividendScore,
      score.growthScore,
    ]
      .map((v) => v.toFixed(0))
      .join(", ")}]`,
  ].join("\n");
  return fence(body);
}
