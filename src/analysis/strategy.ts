import {
  BuyPlan,
  CandleMetrics,
  FundamentalScore,
  InstitutionalMetrics,
  SellPlan,
  StrategyRecommendation,
  SupportResistanceLevel,
  TradeZone,
  TrendAnalysis,
  VolumeMetrics,
} from "../types/analysis";

type StrategyContext = {
  latestPrice: number;
  trend: TrendAnalysis;
  candles: CandleMetrics[];
  volumes: VolumeMetrics[];
  institutional: InstitutionalMetrics[];
  fundamental?: FundamentalScore;
  levels: SupportResistanceLevel[];
};

function zone(
  center: number,
  widthPct: number,
  action: TradeZone["action"],
  positionRatio: number,
  reason: string
): TradeZone {
  const delta = center * widthPct;
  return {
    minPrice: Number((center - delta).toFixed(2)),
    maxPrice: Number((center + delta).toFixed(2)),
    action,
    positionRatio,
    reason,
  };
}

function firstSupport(levels: SupportResistanceLevel[]): SupportResistanceLevel | undefined {
  return levels.filter((l) => l.type === "SUPPORT").sort((a, b) => b.price - a.price)[0];
}

function secondSupport(levels: SupportResistanceLevel[]): SupportResistanceLevel | undefined {
  const supports = levels.filter((l) => l.type === "SUPPORT").sort((a, b) => b.price - a.price);
  return supports[1];
}

function firstResistance(levels: SupportResistanceLevel[]): SupportResistanceLevel | undefined {
  return levels.filter((l) => l.type === "RESISTANCE").sort((a, b) => a.price - b.price)[0];
}

function secondResistance(levels: SupportResistanceLevel[]): SupportResistanceLevel | undefined {
  const res = levels.filter((l) => l.type === "RESISTANCE").sort((a, b) => a.price - b.price);
  return res[1];
}

function recentForeignNet(institutional: InstitutionalMetrics[], days: number): number {
  return institutional.slice(-days).reduce((acc, i) => acc + i.foreignInvestor, 0);
}
function recentTotalNet(institutional: InstitutionalMetrics[], days: number): number {
  return institutional.slice(-days).reduce((acc, i) => acc + i.total, 0);
}

function hasRecentSignal(
  items: { signals: string[] }[],
  signal: string,
  days: number
): boolean {
  return items.slice(-days).some((i) => i.signals.includes(signal));
}

export function shortTermStrategy(ctx: StrategyContext): StrategyRecommendation {
  const { latestPrice, trend, candles, volumes, institutional, levels } = ctx;
  const reasons: string[] = [];
  const invalidationSignals: string[] = [];

  const support1 = firstSupport(levels);
  const resistance1 = firstResistance(levels);
  const resistance2 = secondResistance(levels);

  const lastCandle = candles[candles.length - 1];
  const lastVolume = volumes[volumes.length - 1];
  const lastInst = institutional[institutional.length - 1];

  const foreignNet5 = recentForeignNet(institutional, 5);
  const hasLongLower = hasRecentSignal(candles, "LONG_LOWER_SHADOW", 3);
  const hasLongUpper = hasRecentSignal(candles, "LONG_UPPER_SHADOW", 3);
  const hasDistribution = hasRecentSignal(volumes, "DISTRIBUTION_VOLUME", 3);

  let bias: StrategyRecommendation["bias"] = "NEUTRAL";
  let action: StrategyRecommendation["action"] = "WAIT";

  if (
    (trend.stage === "EARLY_UPTREND" || trend.stage === "PULLBACK" || trend.stage === "BASE_BUILDING") &&
    hasLongLower &&
    foreignNet5 >= 0 &&
    !hasDistribution
  ) {
    bias = "BULLISH";
    action = "BUY";
    reasons.push("支撐區出現長下影承接訊號");
    reasons.push("近 5 日外資合計未呈現連續賣超");
  } else if (trend.stage === "MAIN_UPTREND" && !hasLongUpper && lastVolume.volumeRatio20 >= 1.1) {
    bias = "BULLISH";
    action = "HOLD";
    reasons.push("主升段且量能未出現爆量不漲");
  } else if (trend.stage === "HIGH_VOLATILITY" || hasDistribution) {
    bias = "HIGH_RISK";
    action = "REDUCE";
    reasons.push("高檔震盪且近期出現爆量或長上影");
  } else if (trend.stage === "DOWNTREND") {
    bias = "BEARISH";
    action = "SELL";
    reasons.push("空頭趨勢，短線不追多");
  } else {
    bias = "NEUTRAL";
    action = "WAIT";
    reasons.push("訊號混雜，建議空手等待明確訊號");
  }

  const buyZones: TradeZone[] = [];
  const sellZones: TradeZone[] = [];
  const stopLossZones: TradeZone[] = [];
  const takeProfitZones: TradeZone[] = [];

  if (support1 && action === "BUY") {
    buyZones.push(
      zone(support1.price, 0.015, "BUY", 0.2, "第一支撐測試不破且出現止跌訊號")
    );
  }
  if (resistance1) {
    takeProfitZones.push(
      zone(resistance1.price, 0.01, "TAKE_PROFIT", 0.3, "第一壓力區，若量縮或長上影先減碼")
    );
  }
  if (resistance2) {
    takeProfitZones.push(
      zone(resistance2.price, 0.01, "TAKE_PROFIT", 0.3, "第二壓力區，若爆量不漲繼續減碼")
    );
  }
  if (support1) {
    stopLossZones.push(
      zone(support1.price * 0.97, 0.005, "STOP_LOSS", 1.0, "跌破第一支撐 3% 以上確認破位")
    );
  }

  invalidationSignals.push("跌破第一支撐且站不回");
  invalidationSignals.push("反彈量縮且留長上影");
  invalidationSignals.push("三大法人連續賣超");

  return {
    timeframe: "SHORT_TERM",
    bias,
    action,
    buyZones,
    sellZones,
    stopLossZones,
    takeProfitZones,
    reasons,
    invalidationSignals,
  };
}

export function midTermStrategy(ctx: StrategyContext): StrategyRecommendation {
  const { latestPrice, trend, institutional, fundamental, levels } = ctx;
  const reasons: string[] = [];
  const invalidationSignals: string[] = [];

  const support1 = firstSupport(levels);
  const support2 = secondSupport(levels);
  const resistance1 = firstResistance(levels);

  const totalNet20 = recentTotalNet(institutional, 20);

  let bias: StrategyRecommendation["bias"] = "NEUTRAL";
  let action: StrategyRecommendation["action"] = "WAIT";

  const fundamentalOk =
    !fundamental || fundamental.rating === "STRONG" || fundamental.rating === "GOOD" || fundamental.rating === "NEUTRAL";

  if (
    (trend.stage === "PULLBACK" || trend.stage === "EARLY_UPTREND" || trend.stage === "BASE_BUILDING") &&
    fundamentalOk &&
    totalNet20 >= 0
  ) {
    bias = "BULLISH";
    action = "BUY";
    reasons.push("回檔或築底位置且近 20 日三大法人未明顯賣超");
    if (fundamental) reasons.push(`基本面：${fundamental.rating}`);
  } else if (trend.stage === "MAIN_UPTREND" && fundamentalOk) {
    bias = "BULLISH";
    action = "HOLD";
    reasons.push("主升段續抱，回測 20 / 60 日均線可加碼");
  } else if (trend.stage === "HIGH_VOLATILITY") {
    bias = "HIGH_RISK";
    action = "REDUCE";
    reasons.push("高檔震盪，中線應分批減碼");
  } else if (trend.stage === "DOWNTREND" || !fundamentalOk) {
    bias = "BEARISH";
    action = "SELL";
    reasons.push("空頭趨勢或基本面轉弱，不逢低接");
  } else {
    bias = "NEUTRAL";
    action = "WAIT";
    reasons.push("等待趨勢明朗");
  }

  const buyZones: TradeZone[] = [];
  const sellZones: TradeZone[] = [];
  const stopLossZones: TradeZone[] = [];
  const takeProfitZones: TradeZone[] = [];

  if (action === "BUY" && support1) {
    buyZones.push(
      zone(support1.price, 0.02, "BUY", 0.25, "第一批：回測中期支撐")
    );
  }
  if (action === "BUY" && support2) {
    buyZones.push(
      zone(support2.price, 0.02, "ADD", 0.25, "第二批：回到次級支撐，確認基本面未轉弱")
    );
  }
  if (resistance1) {
    takeProfitZones.push(
      zone(resistance1.price, 0.015, "TAKE_PROFIT", 0.3, "反彈至中期壓力區先減碼")
    );
  }
  if (support2) {
    stopLossZones.push(
      zone(support2.price * 0.95, 0.005, "STOP_LOSS", 1.0, "跌破次級支撐 5% 中期趨勢轉弱")
    );
  }

  invalidationSignals.push("跌破中期支撐且放量黑 K");
  invalidationSignals.push("外資連續 5 - 10 日賣超");
  invalidationSignals.push("月營收連續兩個月年增轉弱");
  invalidationSignals.push("反彈站不回前支撐");

  return {
    timeframe: "MID_TERM",
    bias,
    action,
    buyZones,
    sellZones,
    stopLossZones,
    takeProfitZones,
    reasons,
    invalidationSignals,
  };
}

export function longTermStrategy(ctx: StrategyContext): StrategyRecommendation {
  const { latestPrice, trend, fundamental, levels } = ctx;
  const reasons: string[] = [];
  const invalidationSignals: string[] = [];

  const support2 = secondSupport(levels);
  const support1 = firstSupport(levels);

  let bias: StrategyRecommendation["bias"] = "NEUTRAL";
  let action: StrategyRecommendation["action"] = "WAIT";

  if (!fundamental) {
    bias = "NEUTRAL";
    action = "WAIT";
    reasons.push("缺乏基本面資料，長線策略無法判斷");
  } else if (fundamental.rating === "STRONG" || fundamental.rating === "GOOD") {
    if (trend.stage === "DOWNTREND" || trend.stage === "PULLBACK") {
      bias = "BULLISH";
      action = "BUY";
      reasons.push("基本面佳且股價處於回檔或調整，長線佈局機會");
    } else if (trend.stage === "MAIN_UPTREND") {
      bias = "BULLISH";
      action = "HOLD";
      reasons.push("基本面佳且主升段續抱");
    } else {
      bias = "BULLISH";
      action = "HOLD";
      reasons.push("基本面良好，可持有核心部位");
    }
  } else if (fundamental.rating === "NEUTRAL") {
    bias = "NEUTRAL";
    action = "HOLD";
    reasons.push("基本面中性，維持核心但不加碼");
  } else {
    bias = "BEARISH";
    action = "SELL";
    reasons.push("基本面偏弱或不佳，長線不持有");
  }

  const buyZones: TradeZone[] = [];
  const sellZones: TradeZone[] = [];
  const stopLossZones: TradeZone[] = [];
  const takeProfitZones: TradeZone[] = [];

  if (action === "BUY" && support1) {
    buyZones.push(
      zone(support1.price, 0.02, "BUY", 0.3, "長線第一批：合理估值區")
    );
  }
  if (action === "BUY" && support2) {
    buyZones.push(
      zone(support2.price, 0.025, "ADD", 0.4, "長線第二批：安全邊際區")
    );
  }

  invalidationSignals.push("月營收連續 2 - 3 個月年增轉負");
  invalidationSignals.push("EPS 顯著下修");
  invalidationSignals.push("毛利率連續衰退");
  invalidationSignals.push("產業題材未轉化為實際營收");
  invalidationSignals.push("高本益比但成長停滯");
  invalidationSignals.push("跌破長期支撐且站不回");

  return {
    timeframe: "LONG_TERM",
    bias,
    action,
    buyZones,
    sellZones,
    stopLossZones,
    takeProfitZones,
    reasons,
    invalidationSignals,
  };
}

export function buildBuyPlan(ctx: StrategyContext): BuyPlan {
  const { trend, fundamental, levels } = ctx;
  const entries: TradeZone[] = [];

  const supports = levels
    .filter((l) => l.type === "SUPPORT")
    .sort((a, b) => b.price - a.price);
  const s1 = supports[0];
  const s2 = supports[1];
  const s3 = supports[2];
  const s4 = supports[3];

  if (s1) {
    entries.push(
      zone(s1.price, 0.015, "BUY", 0.25, "第一批：短線支撐測試不破且出現止跌訊號")
    );
  }
  if (s2) {
    entries.push(
      zone(s2.price, 0.02, "ADD", 0.25, "第二批：站回關鍵壓力或次級支撐承接")
    );
  }
  if (s3) {
    entries.push(
      zone(s3.price, 0.02, "ADD", 0.25, "第三批：中期合理估值區，基本面未轉弱")
    );
  }
  if (s4 && fundamental && (fundamental.rating === "STRONG" || fundamental.rating === "GOOD")) {
    entries.push(
      zone(s4.price, 0.025, "ADD", 0.25, "第四批：長線安全邊際區，基本面仍佳")
    );
  }

  return {
    totalPlannedPosition: entries.reduce((acc, e) => acc + e.positionRatio, 0),
    entries,
  };
}

export function buildSellPlan(ctx: StrategyContext): SellPlan {
  const { levels, trend } = ctx;
  const exits: TradeZone[] = [];

  const resistances = levels
    .filter((l) => l.type === "RESISTANCE")
    .sort((a, b) => a.price - b.price);
  const r1 = resistances[0];
  const r2 = resistances[1];
  const r3 = resistances[2];

  if (r1) {
    exits.push(
      zone(r1.price, 0.01, "REDUCE", 0.25, "第一批：反彈至第一壓力且量縮或長上影")
    );
  }
  if (r2) {
    exits.push(
      zone(r2.price, 0.01, "REDUCE", 0.35, "第二批：反彈至高檔壓力且爆量不漲")
    );
  }
  if (r3) {
    exits.push(
      zone(r3.price, 0.015, "SELL", 0.25, "第三批：突破前高失敗，確認為假突破")
    );
  }

  const currentPosition =
    trend.stage === "MAIN_UPTREND" ? 0.8 :
    trend.stage === "EARLY_UPTREND" ? 0.6 :
    trend.stage === "HIGH_VOLATILITY" ? 0.4 :
    trend.stage === "PULLBACK" ? 0.5 :
    trend.stage === "BASE_BUILDING" ? 0.3 :
    trend.stage === "DOWNTREND" ? 0.0 :
    0.3;

  return {
    currentPosition,
    exits,
  };
}

export type { StrategyContext };
