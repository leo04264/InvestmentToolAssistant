import { FundamentalData } from "../types/stock";
import { FundamentalRating, FundamentalScore } from "../types/analysis";

function scoreRevenue(yoy?: number): number {
  if (yoy === undefined) return 50;
  if (yoy >= 30) return 90;
  if (yoy >= 15) return 75;
  if (yoy >= 5) return 60;
  if (yoy >= 0) return 50;
  if (yoy >= -10) return 35;
  return 20;
}

function scoreProfitability(
  gross?: number,
  operating?: number,
  net?: number
): number {
  const parts: number[] = [];

  if (gross !== undefined) {
    if (gross >= 50) parts.push(90);
    else if (gross >= 30) parts.push(75);
    else if (gross >= 15) parts.push(55);
    else parts.push(35);
  }
  if (operating !== undefined) {
    if (operating >= 20) parts.push(90);
    else if (operating >= 10) parts.push(70);
    else if (operating >= 5) parts.push(55);
    else parts.push(35);
  }
  if (net !== undefined) {
    if (net >= 20) parts.push(90);
    else if (net >= 10) parts.push(70);
    else if (net >= 5) parts.push(55);
    else parts.push(35);
  }

  if (parts.length === 0) return 50;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

function scoreValuation(pe?: number, pb?: number): number {
  const parts: number[] = [];
  if (pe !== undefined) {
    if (pe <= 0) parts.push(30);
    else if (pe < 12) parts.push(80);
    else if (pe <= 20) parts.push(70);
    else if (pe <= 30) parts.push(55);
    else if (pe <= 40) parts.push(40);
    else parts.push(25);
  }
  if (pb !== undefined) {
    if (pb <= 1) parts.push(80);
    else if (pb <= 2) parts.push(70);
    else if (pb <= 3) parts.push(55);
    else if (pb <= 5) parts.push(40);
    else parts.push(30);
  }
  if (parts.length === 0) return 50;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

function scoreDividend(yieldPct?: number): number {
  if (yieldPct === undefined) return 50;
  if (yieldPct >= 6) return 90;
  if (yieldPct >= 4) return 75;
  if (yieldPct >= 2) return 60;
  if (yieldPct >= 1) return 45;
  return 30;
}

function scoreGrowth(
  epsTTM?: number,
  epsLastYear?: number,
  quarterlyYoY?: number
): number {
  const parts: number[] = [];

  if (epsTTM !== undefined && epsLastYear !== undefined && epsLastYear !== 0) {
    const growth = (epsTTM - epsLastYear) / Math.abs(epsLastYear);
    if (growth >= 0.3) parts.push(90);
    else if (growth >= 0.1) parts.push(75);
    else if (growth >= 0) parts.push(55);
    else if (growth >= -0.1) parts.push(40);
    else parts.push(25);
  }
  if (quarterlyYoY !== undefined) {
    if (quarterlyYoY >= 30) parts.push(90);
    else if (quarterlyYoY >= 10) parts.push(70);
    else if (quarterlyYoY >= 0) parts.push(55);
    else parts.push(35);
  }
  if (parts.length === 0) return 50;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

function rate(total: number): FundamentalRating {
  if (total >= 80) return "STRONG";
  if (total >= 65) return "GOOD";
  if (total >= 50) return "NEUTRAL";
  if (total >= 35) return "WEAK";
  return "BAD";
}

export function analyzeFundamental(
  data?: FundamentalData
): FundamentalScore | undefined {
  if (!data) return undefined;

  const revenueScore = scoreRevenue(data.monthlyRevenueYoY);
  const profitabilityScore = scoreProfitability(
    data.grossMargin,
    data.operatingMargin,
    data.netMargin
  );
  const valuationScore = scoreValuation(data.peRatio, data.pbRatio);
  const dividendScore = scoreDividend(data.dividendYield);
  const growthScore = scoreGrowth(
    data.epsTTM,
    data.epsLastYear,
    data.quarterlyRevenueYoY
  );

  const totalScore =
    revenueScore * 0.25 +
    profitabilityScore * 0.25 +
    valuationScore * 0.2 +
    dividendScore * 0.1 +
    growthScore * 0.2;

  const notes: string[] = [];
  if (data.monthlyRevenueYoY !== undefined) {
    if (data.monthlyRevenueYoY >= 15) notes.push("月營收年增率明顯成長");
    else if (data.monthlyRevenueYoY < 0) notes.push("月營收年增率轉負，成長動能轉弱");
  }
  if (data.grossMargin !== undefined && data.grossMargin < 15) {
    notes.push("毛利率偏低，獲利彈性有限");
  }
  if (data.peRatio !== undefined && data.peRatio > 40) {
    notes.push("本益比偏高，需要強成長支撐");
  }
  if (data.dividendYield !== undefined && data.dividendYield >= 4) {
    notes.push("現金殖利率具備防禦性");
  }
  if (
    data.epsTTM !== undefined &&
    data.epsLastYear !== undefined &&
    data.epsTTM < data.epsLastYear
  ) {
    notes.push("近四季 EPS 低於去年，EPS 成長動能轉弱");
  }

  return {
    revenueScore,
    profitabilityScore,
    valuationScore,
    dividendScore,
    growthScore,
    totalScore,
    rating: rate(totalScore),
    notes,
  };
}

export function describeRating(rating: FundamentalRating): string {
  const map: Record<FundamentalRating, string> = {
    STRONG: "基本面強勁",
    GOOD: "基本面良好",
    NEUTRAL: "基本面中性",
    WEAK: "基本面偏弱",
    BAD: "基本面不佳",
  };
  return map[rating];
}
