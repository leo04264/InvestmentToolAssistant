export type CandleSignal =
  | "LONG_UPPER_SHADOW"
  | "LONG_LOWER_SHADOW"
  | "STRONG_RED_CANDLE"
  | "STRONG_BLACK_CANDLE"
  | "DOJI"
  | "HIGH_VOLUME_BLACK_CANDLE"
  | "HIGH_VOLUME_RED_CANDLE"
  | "BREAKOUT_CANDLE"
  | "BREAKDOWN_CANDLE"
  | "REVERSAL_WARNING"
  | "SUPPORT_REBOUND"
  | "UNKNOWN";

export type CandleMetrics = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;

  body: number;
  upperShadow: number;
  lowerShadow: number;
  fullRange: number;

  bodyRatio: number;
  upperShadowRatio: number;
  lowerShadowRatio: number;

  isRedCandle: boolean;
  isBlackCandle: boolean;
  isDojiLike: boolean;

  signals: CandleSignal[];
};

export type VolumeSignal =
  | "VOLUME_EXPANSION"
  | "VOLUME_EXPLOSION"
  | "VOLUME_CONTRACTION"
  | "HEALTHY_PULLBACK"
  | "DISTRIBUTION_VOLUME"
  | "ACCUMULATION_VOLUME"
  | "UNKNOWN";

export type VolumeMetrics = {
  date: string;

  volume: number;
  avgVolume5: number;
  avgVolume20: number;
  volumeRatio5: number;
  volumeRatio20: number;

  isHighVolume: boolean;
  isExplosiveVolume: boolean;
  isLowVolume: boolean;

  signals: VolumeSignal[];
};

export type InstitutionalSignal =
  | "FOREIGN_BUYING"
  | "FOREIGN_SELLING"
  | "TRUST_BUYING"
  | "TRUST_SELLING"
  | "ALL_INSTITUTIONS_BUYING"
  | "ALL_INSTITUTIONS_SELLING"
  | "FOREIGN_SELL_TRUST_BUY"
  | "INSTITUTIONAL_DIVERGENCE"
  | "INSTITUTIONAL_NEUTRAL";

export type InstitutionalMetrics = {
  date: string;

  foreignInvestor: number;
  investmentTrust: number;
  dealer: number;
  total: number;

  foreignBuyStreak: number;
  foreignSellStreak: number;
  trustBuyStreak: number;
  trustSellStreak: number;
  totalBuyStreak: number;
  totalSellStreak: number;

  foreignTradeVolumeRatio: number;
  totalTradeVolumeRatio: number;

  isForeignStrongBuy: boolean;
  isForeignStrongSell: boolean;
  isTotalStrongBuy: boolean;
  isTotalStrongSell: boolean;

  signals: InstitutionalSignal[];
};

export type FundamentalRating =
  | "STRONG"
  | "GOOD"
  | "NEUTRAL"
  | "WEAK"
  | "BAD";

export type FundamentalScore = {
  revenueScore: number;
  profitabilityScore: number;
  valuationScore: number;
  dividendScore: number;
  growthScore: number;
  totalScore: number;
  rating: FundamentalRating;
  notes: string[];
};

export type TrendStage =
  | "BASE_BUILDING"
  | "EARLY_UPTREND"
  | "MAIN_UPTREND"
  | "HIGH_VOLATILITY"
  | "PULLBACK"
  | "DOWNTREND"
  | "UNKNOWN";

export type TrendAnalysis = {
  stage: TrendStage;
  reasons: string[];
  ma5: number;
  ma10: number;
  ma20: number;
  ma60: number;
  position60d: number;
  pctFrom60dHigh: number;
  pctFrom60dLow: number;
};

export type SupportResistanceLevel = {
  price: number;
  type: "SUPPORT" | "RESISTANCE";
  strength: "WEAK" | "MEDIUM" | "STRONG";
  reason: string;
};

export type StrategyTimeframe = "SHORT_TERM" | "MID_TERM" | "LONG_TERM";

export type TradeAction =
  | "BUY"
  | "ADD"
  | "REDUCE"
  | "SELL"
  | "STOP_LOSS"
  | "TAKE_PROFIT"
  | "HOLD"
  | "WAIT";

export type TradeZone = {
  minPrice: number;
  maxPrice: number;
  action: TradeAction;
  positionRatio: number;
  reason: string;
};

export type StrategyRecommendation = {
  timeframe: StrategyTimeframe;
  bias: "BULLISH" | "NEUTRAL" | "BEARISH" | "HIGH_RISK";
  action: "BUY" | "HOLD" | "REDUCE" | "SELL" | "WAIT";
  buyZones: TradeZone[];
  sellZones: TradeZone[];
  stopLossZones: TradeZone[];
  takeProfitZones: TradeZone[];
  reasons: string[];
  invalidationSignals: string[];
};

export type BuyPlan = {
  totalPlannedPosition: number;
  entries: TradeZone[];
};

export type SellPlan = {
  currentPosition: number;
  exits: TradeZone[];
};

export type ReportOutput = {
  summary: string;
  trendAnalysis: string;
  candleAnalysis: string;
  volumeAnalysis: string;
  institutionalAnalysis: string;
  fundamentalAnalysis: string;
  supportResistance: string;
  shortTermStrategy: string;
  midTermStrategy: string;
  longTermStrategy: string;
  buyPlan: string;
  sellPlan: string;
  riskSignals: string;
};

export type AnalysisBundle = {
  stockId: string;
  stockName: string;
  analysisDate: string;
  latestPrice: number;
  candles: CandleMetrics[];
  volumes: VolumeMetrics[];
  institutional: InstitutionalMetrics[];
  trend: TrendAnalysis;
  fundamental?: FundamentalScore;
  levels: SupportResistanceLevel[];
  shortTerm: StrategyRecommendation;
  midTerm: StrategyRecommendation;
  longTerm: StrategyRecommendation;
  buyPlan: BuyPlan;
  sellPlan: SellPlan;
  riskSignals: string[];
};
