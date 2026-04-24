import {
  AnalysisBundle,
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
import { describeCandleSignals } from "./candle";
import { describeInstitutionalSignals } from "./institutional";
import { describeRating } from "./fundamental";
import { describeTrendStage } from "./trend";
import { describeVolumeSignals } from "./volume";

function fmtNum(v: number, digits = 2): string {
  if (!isFinite(v)) return "N/A";
  return v.toFixed(digits);
}

function fmtPct(v: number, digits = 2): string {
  if (!isFinite(v)) return "N/A";
  return `${(v * 100).toFixed(digits)}%`;
}

function fmtVolume(v: number): string {
  if (!isFinite(v)) return "N/A";
  if (v >= 1_0000) return `${(v / 1_0000).toFixed(2)} 萬張`;
  return `${Math.round(v)} 張`;
}

function zonesTable(zones: TradeZone[]): string {
  if (zones.length === 0) return "（暫無建議區）";
  const rows = zones.map(
    (z) =>
      `| ${z.action} | ${fmtNum(z.minPrice)} - ${fmtNum(z.maxPrice)} | ${fmtPct(z.positionRatio, 0)} | ${z.reason} |`
  );
  return [
    "| 動作 | 價格區 | 建議部位 | 原因 |",
    "|---|---:|---:|---|",
    ...rows,
  ].join("\n");
}

function levelsTable(
  levels: SupportResistanceLevel[],
  type: "SUPPORT" | "RESISTANCE"
): string {
  const filtered = levels.filter((l) => l.type === type);
  if (filtered.length === 0) return "（暫無明顯區間）";
  const rows = filtered.map(
    (l) => `| ${fmtNum(l.price)} | ${l.strength} | ${l.reason} |`
  );
  return [
    "| 價格 | 強度 | 原因 |",
    "|---:|---|---|",
    ...rows,
  ].join("\n");
}

function renderSummary(bundle: AnalysisBundle): string {
  const { trend, shortTerm, midTerm, longTerm, latestPrice, fundamental } = bundle;
  const lines: string[] = [];
  lines.push(`- 最新收盤：${fmtNum(latestPrice)}`);
  lines.push(`- 目前趨勢：${describeTrendStage(trend.stage)}`);
  lines.push(`- 短線評價：${shortTerm.bias} / 建議動作：${shortTerm.action}`);
  lines.push(`- 中線評價：${midTerm.bias} / 建議動作：${midTerm.action}`);
  lines.push(`- 長線評價：${longTerm.bias} / 建議動作：${longTerm.action}`);
  if (fundamental) {
    lines.push(
      `- 基本面總分：${fmtNum(fundamental.totalScore, 1)}（${describeRating(fundamental.rating)}）`
    );
  }
  lines.push(`- 主要風險：${[...shortTerm.invalidationSignals, ...midTerm.invalidationSignals].slice(0, 3).join("；")}`);
  return lines.join("\n");
}

function renderTrend(trend: TrendAnalysis): string {
  const lines: string[] = [];
  lines.push(`目前階段：**${describeTrendStage(trend.stage)}**`);
  lines.push("");
  lines.push(`- 5 日均線：${fmtNum(trend.ma5)}`);
  lines.push(`- 10 日均線：${fmtNum(trend.ma10)}`);
  lines.push(`- 20 日均線：${fmtNum(trend.ma20)}`);
  lines.push(`- 60 日均線：${fmtNum(trend.ma60)}`);
  lines.push(`- 位於 60 日區間位置：${fmtPct(trend.position60d, 1)}`);
  lines.push(`- 距 60 日高：${fmtPct(trend.pctFrom60dHigh, 2)}`);
  lines.push(`- 距 60 日低：${fmtPct(trend.pctFrom60dLow, 2)}`);
  lines.push("");
  lines.push("判斷理由：");
  for (const r of trend.reasons) lines.push(`- ${r}`);
  return lines.join("\n");
}

function renderCandles(candles: CandleMetrics[]): string {
  const recent = candles.slice(-5);
  const lines: string[] = [];
  lines.push("近 5 日 K 線訊號：");
  lines.push("");
  lines.push("| 日期 | 開 | 高 | 低 | 收 | 訊號 |");
  lines.push("|---|---:|---:|---:|---:|---|");
  for (const c of recent) {
    lines.push(
      `| ${c.date} | ${fmtNum(c.open)} | ${fmtNum(c.high)} | ${fmtNum(c.low)} | ${fmtNum(c.close)} | ${describeCandleSignals(c.signals)} |`
    );
  }
  const last = recent[recent.length - 1];
  lines.push("");
  lines.push(`最新 K 線解讀：${describeCandleSignals(last.signals)}`);
  return lines.join("\n");
}

function renderVolume(volumes: VolumeMetrics[]): string {
  const recent = volumes.slice(-5);
  const lines: string[] = [];
  lines.push("近 5 日成交量觀察：");
  lines.push("");
  lines.push("| 日期 | 量 | 5日均量比 | 20日均量比 | 訊號 |");
  lines.push("|---|---:|---:|---:|---|");
  for (const v of recent) {
    lines.push(
      `| ${v.date} | ${fmtVolume(v.volume)} | ${fmtNum(v.volumeRatio5, 2)} | ${fmtNum(v.volumeRatio20, 2)} | ${describeVolumeSignals(v.signals)} |`
    );
  }
  return lines.join("\n");
}

function renderInstitutional(institutional: InstitutionalMetrics[]): string {
  const recent = institutional.slice(-5);
  const lines: string[] = [];
  lines.push("近 5 日三大法人買賣超（單位：張）：");
  lines.push("");
  lines.push("| 日期 | 外資 | 投信 | 自營 | 合計 | 訊號 |");
  lines.push("|---|---:|---:|---:|---:|---|");
  for (const i of recent) {
    lines.push(
      `| ${i.date} | ${Math.round(i.foreignInvestor)} | ${Math.round(i.investmentTrust)} | ${Math.round(i.dealer)} | ${Math.round(i.total)} | ${describeInstitutionalSignals(i.signals)} |`
    );
  }

  const sum = (key: keyof Pick<InstitutionalMetrics, "foreignInvestor" | "investmentTrust" | "dealer" | "total">, days: number) =>
    institutional.slice(-days).reduce((acc, i) => acc + i[key], 0);

  lines.push("");
  lines.push("近 20 日合計：");
  lines.push(`- 外資：${Math.round(sum("foreignInvestor", 20))} 張`);
  lines.push(`- 投信：${Math.round(sum("investmentTrust", 20))} 張`);
  lines.push(`- 自營商：${Math.round(sum("dealer", 20))} 張`);
  lines.push(`- 三大法人合計：${Math.round(sum("total", 20))} 張`);
  return lines.join("\n");
}

function renderFundamental(score?: FundamentalScore): string {
  if (!score) return "（無基本面資料）";
  const lines: string[] = [];
  lines.push(`總評：**${describeRating(score.rating)}**（總分 ${fmtNum(score.totalScore, 1)} / 100）`);
  lines.push("");
  lines.push("| 項目 | 分數 |");
  lines.push("|---|---:|");
  lines.push(`| 營收成長 | ${fmtNum(score.revenueScore, 0)} |`);
  lines.push(`| 獲利能力 | ${fmtNum(score.profitabilityScore, 0)} |`);
  lines.push(`| 估值 | ${fmtNum(score.valuationScore, 0)} |`);
  lines.push(`| 股利 | ${fmtNum(score.dividendScore, 0)} |`);
  lines.push(`| 成長動能 | ${fmtNum(score.growthScore, 0)} |`);
  if (score.notes.length > 0) {
    lines.push("");
    lines.push("觀察重點：");
    for (const n of score.notes) lines.push(`- ${n}`);
  }
  return lines.join("\n");
}

function renderLevels(levels: SupportResistanceLevel[]): string {
  const lines: string[] = [];
  lines.push("### 壓力區");
  lines.push("");
  lines.push(levelsTable(levels, "RESISTANCE"));
  lines.push("");
  lines.push("### 支撐區");
  lines.push("");
  lines.push(levelsTable(levels, "SUPPORT"));
  return lines.join("\n");
}

function renderStrategy(s: StrategyRecommendation, title: string): string {
  const lines: string[] = [];
  lines.push(`**${title}評價：${s.bias}；建議動作：${s.action}**`);
  lines.push("");
  lines.push("原因：");
  for (const r of s.reasons) lines.push(`- ${r}`);
  lines.push("");
  if (s.buyZones.length > 0) {
    lines.push("買進區：");
    lines.push("");
    lines.push(zonesTable(s.buyZones));
    lines.push("");
  }
  if (s.takeProfitZones.length > 0) {
    lines.push("停利區：");
    lines.push("");
    lines.push(zonesTable(s.takeProfitZones));
    lines.push("");
  }
  if (s.stopLossZones.length > 0) {
    lines.push("停損區：");
    lines.push("");
    lines.push(zonesTable(s.stopLossZones));
    lines.push("");
  }
  lines.push("轉弱 / 撤退訊號：");
  for (const r of s.invalidationSignals) lines.push(`- ${r}`);
  return lines.join("\n");
}

function renderBuyPlan(plan: BuyPlan): string {
  const lines: string[] = [];
  lines.push(
    `規劃部位合計：${fmtPct(plan.totalPlannedPosition, 0)}`
  );
  lines.push("");
  lines.push(zonesTable(plan.entries));
  lines.push("");
  lines.push("禁止加碼條件：");
  lines.push("- 跌破支撐後尚未站回");
  lines.push("- 法人連續賣超");
  lines.push("- 反彈量縮 / 長上影");
  lines.push("- 基本面轉弱");
  lines.push("- 只是為了攤平虧損");
  return lines.join("\n");
}

function renderSellPlan(plan: SellPlan): string {
  const lines: string[] = [];
  lines.push(`目前建議持有部位：${fmtPct(plan.currentPosition, 0)}`);
  lines.push("");
  lines.push(zonesTable(plan.exits));
  lines.push("");
  lines.push("強制減碼條件：");
  lines.push("- 跌破短線支撐");
  lines.push("- 跌破中期支撐");
  lines.push("- 放量黑 K");
  lines.push("- 三大法人同步賣超");
  lines.push("- 外資連續賣超");
  lines.push("- 基本面轉弱");
  return lines.join("\n");
}

function renderRisk(bundle: AnalysisBundle): string {
  const lines: string[] = [];
  lines.push("若出現以下訊號，應重新評估持有：");
  const all = new Set<string>();
  for (const s of [bundle.shortTerm, bundle.midTerm, bundle.longTerm]) {
    for (const r of s.invalidationSignals) all.add(r);
  }
  for (const r of bundle.riskSignals) all.add(r);
  for (const r of all) lines.push(`- ${r}`);
  return lines.join("\n");
}

export function buildReport(bundle: AnalysisBundle): string {
  const lines: string[] = [];
  lines.push(`# 股票分析報告：${bundle.stockName} (${bundle.stockId})`);
  lines.push("");
  lines.push(`> 分析日期：${bundle.analysisDate}`);
  lines.push("");
  lines.push("本報告並非投資建議，而是提供一套可重複使用的分析框架。");
  lines.push("");

  lines.push("## 一、總結判斷");
  lines.push("");
  lines.push(renderSummary(bundle));
  lines.push("");

  lines.push("## 二、趨勢位置");
  lines.push("");
  lines.push(renderTrend(bundle.trend));
  lines.push("");

  lines.push("## 三、K 線訊號");
  lines.push("");
  lines.push(renderCandles(bundle.candles));
  lines.push("");

  lines.push("## 四、成交量分析");
  lines.push("");
  lines.push(renderVolume(bundle.volumes));
  lines.push("");

  lines.push("## 五、法人籌碼分析");
  lines.push("");
  lines.push(renderInstitutional(bundle.institutional));
  lines.push("");

  lines.push("## 六、基本面分析");
  lines.push("");
  lines.push(renderFundamental(bundle.fundamental));
  lines.push("");

  lines.push("## 七、支撐與壓力");
  lines.push("");
  lines.push(renderLevels(bundle.levels));
  lines.push("");

  lines.push("## 八、短線策略（1 - 10 個交易日）");
  lines.push("");
  lines.push(renderStrategy(bundle.shortTerm, "短線"));
  lines.push("");

  lines.push("## 九、中線策略（2 週 - 3 個月）");
  lines.push("");
  lines.push(renderStrategy(bundle.midTerm, "中線"));
  lines.push("");

  lines.push("## 十、長線策略（3 個月以上）");
  lines.push("");
  lines.push(renderStrategy(bundle.longTerm, "長線"));
  lines.push("");

  lines.push("## 十一、分批買入計畫");
  lines.push("");
  lines.push(renderBuyPlan(bundle.buyPlan));
  lines.push("");

  lines.push("## 十二、分批賣出計畫");
  lines.push("");
  lines.push(renderSellPlan(bundle.sellPlan));
  lines.push("");

  lines.push("## 十三、風險訊號");
  lines.push("");
  lines.push(renderRisk(bundle));
  lines.push("");

  return lines.join("\n");
}
