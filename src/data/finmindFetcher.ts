import { AnalysisInput, DailyPrice, FundamentalData, InstitutionalTrade } from "../types/stock";

const FINMIND_BASE = "https://api.finmindtrade.com/api/v4/data";

type FinMindResponse<T> = {
  msg?: string;
  status?: number;
  data?: T[];
};

async function fetchDataset<T>(params: Record<string, string>, token?: string): Promise<T[]> {
  const search = new URLSearchParams(params);
  if (token) search.set("token", token);
  const url = `${FINMIND_BASE}?${search.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`FinMind ${params.dataset} HTTP ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as FinMindResponse<T>;
  if (json.status !== undefined && json.status !== 200) {
    throw new Error(`FinMind ${params.dataset} error: ${json.msg ?? "unknown"}`);
  }
  return json.data ?? [];
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function daysAgo(days: number, base = new Date()): string {
  const d = new Date(base);
  d.setDate(d.getDate() - days);
  return toISODate(d);
}

type FmPriceRow = {
  date: string;
  stock_id: string;
  Trading_Volume: number;
  Trading_money: number;
  open: number;
  max: number;
  min: number;
  close: number;
  spread: number;
  Trading_turnover: number;
};

type FmInstRow = {
  date: string;
  stock_id: string;
  name: string;
  buy: number;
  sell: number;
};

type FmRevenueRow = {
  date: string;
  stock_id: string;
  country: string;
  revenue: number;
  revenue_month: number;
  revenue_year: number;
};

type FmFinancialRow = {
  date: string;
  stock_id: string;
  type: string;
  value: number;
  origin_name?: string;
};

type FmPerRow = {
  date: string;
  stock_id: string;
  dividend_yield: number;
  PER: number;
  PBR: number;
};

type FmStockInfoRow = {
  industry_category: string;
  stock_id: string;
  stock_name: string;
  type: string;
  date?: string;
};

function normalizePrices(rows: FmPriceRow[]): DailyPrice[] {
  return rows
    .filter((r) => r.open > 0 && r.close > 0)
    .map((r) => ({
      date: r.date,
      open: r.open,
      high: r.max,
      low: r.min,
      close: r.close,
      volume: Math.round(r.Trading_Volume / 1000),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function normalizeInstitutional(rows: FmInstRow[]): InstitutionalTrade[] {
  const grouped = new Map<string, InstitutionalTrade>();
  for (const r of rows) {
    const net = Math.round((r.buy - r.sell) / 1000);
    const cur = grouped.get(r.date) ?? {
      date: r.date,
      foreignInvestor: 0,
      investmentTrust: 0,
      dealer: 0,
      total: 0,
    };
    const name = r.name;
    if (name === "Foreign_Investor" || name === "Foreign_Dealer_Self") {
      cur.foreignInvestor += net;
    } else if (name === "Investment_Trust") {
      cur.investmentTrust += net;
    } else if (name === "Dealer_self" || name === "Dealer_Hedging") {
      cur.dealer += net;
    }
    cur.total = cur.foreignInvestor + cur.investmentTrust + cur.dealer;
    grouped.set(r.date, cur);
  }
  return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function calcMonthlyRevenueYoY(rows: FmRevenueRow[]): number | undefined {
  if (rows.length < 13) return undefined;
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const yearAgo = sorted.find(
    (r) => r.revenue_month === latest.revenue_month && r.revenue_year === latest.revenue_year - 1
  );
  if (!yearAgo || yearAgo.revenue === 0) return undefined;
  return Number((((latest.revenue - yearAgo.revenue) / yearAgo.revenue) * 100).toFixed(2));
}

function pickFinancialValue(rows: FmFinancialRow[], type: string): number | undefined {
  const sorted = rows.filter((r) => r.type === type).sort((a, b) => b.date.localeCompare(a.date));
  return sorted[0]?.value;
}

function calcEPSTTM(rows: FmFinancialRow[]): { ttm?: number; lastYear?: number } {
  const epsRows = rows.filter((r) => r.type === "EPS").sort((a, b) => a.date.localeCompare(b.date));
  if (epsRows.length === 0) return {};
  const last4 = epsRows.slice(-4);
  const prev4 = epsRows.slice(-8, -4);
  const ttm = last4.reduce((acc, r) => acc + r.value, 0);
  const lastYear = prev4.length === 4 ? prev4.reduce((acc, r) => acc + r.value, 0) : undefined;
  return {
    ttm: Number(ttm.toFixed(2)),
    lastYear: lastYear !== undefined ? Number(lastYear.toFixed(2)) : undefined,
  };
}

export type FetchOptions = {
  stockId: string;
  token?: string;
  lookbackDays?: number;
  asOf?: string;
};

export async function fetchAnalysisInput(opts: FetchOptions): Promise<AnalysisInput> {
  const lookback = opts.lookbackDays ?? 120;
  const baseDate = opts.asOf ? new Date(opts.asOf) : new Date();
  const startDate = daysAgo(lookback, baseDate);
  const endDate = toISODate(baseDate);

  const revenueStart = daysAgo(420, baseDate);
  const financialStart = daysAgo(800, baseDate);

  const [priceRows, instRows, revenueRows, financialRows, perRows, infoRows] = await Promise.all([
    fetchDataset<FmPriceRow>(
      { dataset: "TaiwanStockPrice", data_id: opts.stockId, start_date: startDate, end_date: endDate },
      opts.token
    ),
    fetchDataset<FmInstRow>(
      {
        dataset: "TaiwanStockInstitutionalInvestorsBuySell",
        data_id: opts.stockId,
        start_date: startDate,
        end_date: endDate,
      },
      opts.token
    ),
    fetchDataset<FmRevenueRow>(
      { dataset: "TaiwanStockMonthRevenue", data_id: opts.stockId, start_date: revenueStart },
      opts.token
    ).catch(() => [] as FmRevenueRow[]),
    fetchDataset<FmFinancialRow>(
      { dataset: "TaiwanStockFinancialStatements", data_id: opts.stockId, start_date: financialStart },
      opts.token
    ).catch(() => [] as FmFinancialRow[]),
    fetchDataset<FmPerRow>(
      { dataset: "TaiwanStockPER", data_id: opts.stockId, start_date: startDate, end_date: endDate },
      opts.token
    ).catch(() => [] as FmPerRow[]),
    fetchDataset<FmStockInfoRow>(
      { dataset: "TaiwanStockInfo", data_id: opts.stockId },
      opts.token
    ).catch(() => [] as FmStockInfoRow[]),
  ]);

  const prices = normalizePrices(priceRows);
  if (prices.length === 0) {
    throw new Error(`FinMind 沒有回傳 ${opts.stockId} 的日 K 資料；請確認代號或縮短時間區間`);
  }
  const trades = normalizeInstitutional(instRows);

  const stockName = infoRows[0]?.stock_name ?? opts.stockId;

  const monthlyRevenueYoY = calcMonthlyRevenueYoY(revenueRows);
  const grossMargin = pickFinancialValue(financialRows, "GrossProfit") !== undefined &&
    pickFinancialValue(financialRows, "Revenue") !== undefined
      ? Number(
          (
            ((pickFinancialValue(financialRows, "GrossProfit") as number) /
              (pickFinancialValue(financialRows, "Revenue") as number)) *
            100
          ).toFixed(2)
        )
      : undefined;
  const operatingMargin = pickFinancialValue(financialRows, "OperatingIncome") !== undefined &&
    pickFinancialValue(financialRows, "Revenue") !== undefined
      ? Number(
          (
            ((pickFinancialValue(financialRows, "OperatingIncome") as number) /
              (pickFinancialValue(financialRows, "Revenue") as number)) *
            100
          ).toFixed(2)
        )
      : undefined;
  const netMargin = pickFinancialValue(financialRows, "IncomeAfterTaxes") !== undefined &&
    pickFinancialValue(financialRows, "Revenue") !== undefined
      ? Number(
          (
            ((pickFinancialValue(financialRows, "IncomeAfterTaxes") as number) /
              (pickFinancialValue(financialRows, "Revenue") as number)) *
            100
          ).toFixed(2)
        )
      : undefined;

  const eps = calcEPSTTM(financialRows);
  const latestPer = perRows.length > 0 ? perRows[perRows.length - 1] : undefined;

  const fundamentals: FundamentalData = {
    stockId: opts.stockId,
    stockName,
    monthlyRevenueYoY,
    epsTTM: eps.ttm,
    epsLastYear: eps.lastYear,
    grossMargin,
    operatingMargin,
    netMargin,
    peRatio: latestPer?.PER,
    pbRatio: latestPer?.PBR,
    dividendYield: latestPer?.dividend_yield,
  };

  const analysisDate = prices[prices.length - 1].date;

  return {
    stockId: opts.stockId,
    stockName,
    prices,
    institutionalTrades: trades,
    fundamentals,
    analysisDate,
    lookbackDays: lookback,
  };
}
