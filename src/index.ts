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
import { fetchAnalysisInput } from "./data/finmindFetcher";
import { renderCandleSVG } from "./charts/svg";

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
  if (lastInst && lastInst.foreignSellStreak >= 3) {
    riskSignals.push(`外資已連續賣超 ${lastInst.foreignSellStreak} 日`);
  }
  if (lastInst && lastInst.totalSellStreak >= 3) {
    riskSignals.push(`三大法人已連續賣超 ${lastInst.totalSellStreak} 日`);
  }
  const lastVol = volumes[volumes.length - 1];
  if (lastVol && lastVol.signals.includes("DISTRIBUTION_VOLUME")) {
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

type CliOptions = {
  output?: string;
  jsonPath?: string;
  fetchStockId?: string;
  token?: string;
  asOf?: string;
};

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if ((arg === "-o" || arg === "--output") && argv[i + 1]) {
      opts.output = argv[i + 1];
      i++;
    } else if ((arg === "-i" || arg === "--input") && argv[i + 1]) {
      opts.jsonPath = argv[i + 1];
      i++;
    } else if (arg === "--fetch" && argv[i + 1] && !argv[i + 1].startsWith("-")) {
      opts.fetchStockId = argv[i + 1];
      i++;
    } else if (arg === "--token" && argv[i + 1]) {
      opts.token = argv[i + 1];
      i++;
    } else if (arg === "--as-of" && argv[i + 1]) {
      opts.asOf = argv[i + 1];
      i++;
    }
  }
  return opts;
}

async function loadInput(opts: CliOptions): Promise<AnalysisInput> {
  if (opts.fetchStockId) {
    return fetchAnalysisInput({
      stockId: opts.fetchStockId,
      token: opts.token ?? process.env.FINMIND_TOKEN,
      asOf: opts.asOf,
    });
  }
  if (opts.jsonPath) {
    const abs = path.resolve(opts.jsonPath);
    const raw = fs.readFileSync(abs, "utf-8");
    return JSON.parse(raw) as AnalysisInput;
  }
  return buildMockInput();
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const input = await loadInput(opts);
  const bundle = analyze(input);

  let candleChartPath: string | undefined;
  if (opts.output) {
    const outAbs = path.resolve(opts.output);
    const outDir = path.dirname(outAbs);
    const assetsDir = path.join(outDir, "assets");
    fs.mkdirSync(assetsDir, { recursive: true });

    const svg = renderCandleSVG({
      prices: input.prices,
      candles: bundle.candles,
      levels: bundle.levels,
      title: `${bundle.stockName} (${bundle.stockId}) — ${bundle.analysisDate}`,
    });
    const svgPath = path.join(assetsDir, `${bundle.stockId}-candles.svg`);
    fs.writeFileSync(svgPath, svg, "utf-8");
    candleChartPath = path.relative(outDir, svgPath).split(path.sep).join("/");

    const report = buildReport(bundle, { candleChartPath });
    fs.writeFileSync(outAbs, report, "utf-8");
    process.stdout.write(`Report written to ${outAbs}\n`);
    process.stdout.write(`Candle SVG written to ${svgPath}\n`);
  } else {
    const report = buildReport(bundle);
    process.stdout.write(report);
  }
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
