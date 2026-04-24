import { AnalysisInput, DailyPrice, FundamentalData, InstitutionalTrade } from "../types/stock";

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

type Phase = {
  days: number;
  trend: number;
  volatility: number;
  baseVolume: number;
  foreignBias: number;
  trustBias: number;
  dealerBias: number;
};

const PHASES: Phase[] = [
  { days: 25, trend: -0.001, volatility: 0.012, baseVolume: 8000, foreignBias: -0.3, trustBias: -0.2, dealerBias: -0.1 },
  { days: 20, trend: 0.0005, volatility: 0.010, baseVolume: 7000, foreignBias: 0.1, trustBias: 0.1, dealerBias: 0.0 },
  { days: 25, trend: 0.008, volatility: 0.015, baseVolume: 12000, foreignBias: 0.6, trustBias: 0.3, dealerBias: 0.2 },
  { days: 15, trend: -0.002, volatility: 0.018, baseVolume: 11000, foreignBias: -0.2, trustBias: 0.2, dealerBias: -0.1 },
  { days: 5, trend: 0.004, volatility: 0.013, baseVolume: 10500, foreignBias: 0.3, trustBias: 0.3, dealerBias: 0.1 },
];

function generateScenario(
  startDate: string,
  startPrice: number,
  seed: number
): { prices: DailyPrice[]; trades: InstitutionalTrade[] } {
  const rand = seeded(seed);
  const prices: DailyPrice[] = [];
  const trades: InstitutionalTrade[] = [];

  let current = new Date(startDate);
  let price = startPrice;

  for (const phase of PHASES) {
    let generated = 0;
    while (generated < phase.days) {
      if (isWeekend(current)) {
        current = addDays(current, 1);
        continue;
      }

      const drift = phase.trend;
      const noise = (rand() - 0.5) * 2 * phase.volatility;
      const changePct = drift + noise;

      const open = price * (1 + (rand() - 0.5) * 0.004);
      const close = open * (1 + changePct);
      const highBase = Math.max(open, close);
      const lowBase = Math.min(open, close);
      const shadowUp = Math.abs(rand() - 0.5) * phase.volatility * 1.1 * price;
      const shadowDn = Math.abs(rand() - 0.5) * phase.volatility * 1.1 * price;
      const high = highBase + shadowUp;
      const low = Math.max(lowBase - shadowDn, 0.1);

      const volMultiplier =
        1 +
        (rand() - 0.4) * 0.6 +
        (Math.abs(changePct) > phase.volatility * 1.2 ? 0.6 : 0);
      const volume = Math.max(
        1000,
        Math.round(phase.baseVolume * volMultiplier)
      );

      const dateStr = toISODate(current);
      prices.push({
        date: dateStr,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume,
      });

      const foreign = Math.round(
        (phase.foreignBias + (rand() - 0.5) * 0.6) * volume * 0.18
      );
      const trust = Math.round(
        (phase.trustBias + (rand() - 0.5) * 0.8) * volume * 0.05
      );
      const dealer = Math.round(
        (phase.dealerBias + (rand() - 0.5) * 1.0) * volume * 0.03
      );
      const total = foreign + trust + dealer;

      trades.push({
        date: dateStr,
        foreignInvestor: foreign,
        investmentTrust: trust,
        dealer,
        total,
      });

      price = close;
      current = addDays(current, 1);
      generated++;
    }
  }

  return { prices, trades };
}

export function buildMockInput(): AnalysisInput {
  const { prices, trades } = generateScenario("2026-01-05", 180, 17);

  const fundamentals: FundamentalData = {
    stockId: "2330",
    stockName: "台積電",
    monthlyRevenueYoY: 22.5,
    quarterlyRevenueYoY: 18.7,
    epsTTM: 45.8,
    epsLastYear: 38.2,
    grossMargin: 53.2,
    operatingMargin: 41.8,
    netMargin: 37.5,
    peRatio: 18.5,
    pbRatio: 4.2,
    dividendYield: 2.1,
  };

  const lastDate = prices[prices.length - 1].date;

  return {
    stockId: fundamentals.stockId,
    stockName: fundamentals.stockName,
    prices,
    institutionalTrades: trades,
    fundamentals,
    analysisDate: lastDate,
    lookbackDays: 60,
  };
}
