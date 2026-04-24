export type DailyPrice = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type InstitutionalTrade = {
  date: string;
  foreignInvestor: number;
  investmentTrust: number;
  dealer: number;
  total: number;
};

export type FundamentalData = {
  stockId: string;
  stockName: string;

  monthlyRevenueYoY?: number;
  quarterlyRevenueYoY?: number;
  epsTTM?: number;
  epsLastYear?: number;
  grossMargin?: number;
  operatingMargin?: number;
  netMargin?: number;
  peRatio?: number;
  pbRatio?: number;
  dividendYield?: number;
};

export type AnalysisInput = {
  stockId: string;
  stockName: string;
  prices: DailyPrice[];
  institutionalTrades: InstitutionalTrade[];
  fundamentals?: FundamentalData;
  analysisDate: string;
  lookbackDays: number;
};
