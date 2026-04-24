#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";

import { AnalysisInput } from "./types/stock";
import { AnalysisBundle } from "./types/analysis";
import { computeCandleSeries } from "./analysis/candle";
import { computeVolumeSeries } from "./analysis/volume";
import { computeInstitutionalSeries } from "./analysis/institutional";
import { analyzeTrend } from "./analysis/trend";
import { analyzeFundamental } from "./analysis/fundamental";
import { findSupportResistance } from "./analysis/supportResistance";
import {
  buildBuyPlan,
  buildSellPlan,
  longTermStrategy,
  midTermStrategy,
  shortTermStrategy,
  StrategyContext,
} from "./analysis/strategy";
import { buildReport } from "./analysis/report";
import { buildMockInput } from "./data/mockStockData";

export function analyze(input: AnalysisInput): AnalysisBundle {
  const candles = computeCandleSeries(input.prices);
  const volumes = computeVolumeSeries(input.prices);
  const institutional = computeInstitutionalSeries(
    input.prices,
    input.institutionalTrades
  );
  const trend = analyzeTrend(input.prices, candles, volumes, institutional);
  const fundamental = analyzeFundamental(input.fundamentals);
  const levels = findSupportResistance(input.prices, candles, volumes);

  const latestPrice = input.prices[input.prices.length - 1].close;

  const ctx: StrategyContext = {
    latestPrice,
    trend,
    candles,
    volumes,
    institutional,
    fundamental,
    levels,
  };

  const shortTerm = shortTermStrategy(ctx);
  const midTerm = midTermStrategy(ctx);
  const longTerm = longTermStrategy(ctx);
  const buyPlan = buildBuyPlan(ctx);
  const sellPlan = buildSellPlan(ctx);

  const riskSignals: string[] = [];
  const lastInst = institutional[institutional.length - 1];
  if (lastInst.foreignSellStreak >= 3) {
    riskSignals.push(`外資已連續賣超 ${lastInst.foreignSellStreak} 日`);
  }
  if (lastInst.totalSellStreak >= 3) {
    riskSignals.push(`三大法人已連續賣超 ${lastInst.totalSellStreak} 日`);
  }
  const lastVol = volumes[volumes.length - 1];
  if (lastVol.signals.includes("DISTRIBUTION_VOLUME")) {
    riskSignals.push("最新 K 線出現爆量不漲或長上影，疑似高檔出貨");
  }

  return {
    stockId: input.stockId,
    stockName: input.stockName,
    analysisDate: input.analysisDate,
    latestPrice,
    candles,
    volumes,
    institutional,
    trend,
    fundamental,
    levels,
    shortTerm,
    midTerm,
    longTerm,
    buyPlan,
    sellPlan,
    riskSignals,
  };
}

function parseArgs(argv: string[]): { output?: string; jsonPath?: string } {
  const opts: { output?: string; jsonPath?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if ((arg === "-o" || arg === "--output") && argv[i + 1]) {
      opts.output = argv[i + 1];
      i++;
    } else if ((arg === "-i" || arg === "--input") && argv[i + 1]) {
      opts.jsonPath = argv[i + 1];
      i++;
    }
  }
  return opts;
}

function loadInput(jsonPath?: string): AnalysisInput {
  if (!jsonPath) return buildMockInput();
  const abs = path.resolve(jsonPath);
  const raw = fs.readFileSync(abs, "utf-8");
  return JSON.parse(raw) as AnalysisInput;
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  const input = loadInput(opts.jsonPath);
  const bundle = analyze(input);
  const report = buildReport(bundle);

  if (opts.output) {
    const abs = path.resolve(opts.output);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, report, "utf-8");
    process.stdout.write(`Report written to ${abs}\n`);
  } else {
    process.stdout.write(report);
  }
}

if (require.main === module) {
  main();
}
