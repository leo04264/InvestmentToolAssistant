import { CandleMetrics, SupportResistanceLevel } from "../types/analysis";
import { DailyPrice } from "../types/stock";

const W = 1200;
const H = 700;
const PRICE_TOP = 50;
const PRICE_BOTTOM = 460;
const VOL_TOP = 500;
const VOL_BOTTOM = 660;
const PLOT_LEFT = 70;
const PLOT_RIGHT = 1180;

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function ma(prices: DailyPrice[], period: number): (number | null)[] {
  return prices.map((_, idx) => {
    if (idx + 1 < period) return null;
    const slice = prices.slice(idx + 1 - period, idx + 1);
    return slice.reduce((acc, p) => acc + p.close, 0) / period;
  });
}

export type CandleChartOptions = {
  prices: DailyPrice[];
  candles: CandleMetrics[];
  levels: SupportResistanceLevel[];
  title: string;
  lookback?: number;
};

export function renderCandleSVG(opts: CandleChartOptions): string {
  const lookback = opts.lookback ?? 60;
  const prices = opts.prices.slice(-lookback);
  const candles = opts.candles.slice(-lookback);
  if (prices.length === 0) return "";

  const minPrice = Math.min(
    ...prices.map((p) => p.low),
    ...opts.levels.map((l) => l.price).filter((p) => p > 0)
  );
  const maxPrice = Math.max(
    ...prices.map((p) => p.high),
    ...opts.levels.map((l) => l.price).filter((p) => p > 0)
  );
  const pricePad = (maxPrice - minPrice) * 0.05 || 1;
  const yMin = minPrice - pricePad;
  const yMax = maxPrice + pricePad;

  const maxVolume = Math.max(...prices.map((p) => p.volume), 1);

  const plotWidth = PLOT_RIGHT - PLOT_LEFT;
  const slot = plotWidth / prices.length;
  const candleWidth = Math.max(2, slot * 0.65);

  const xOf = (idx: number) => PLOT_LEFT + slot * (idx + 0.5);
  const yPrice = (v: number) =>
    PRICE_BOTTOM - ((v - yMin) / (yMax - yMin)) * (PRICE_BOTTOM - PRICE_TOP);
  const yVol = (v: number) =>
    VOL_BOTTOM - (v / maxVolume) * (VOL_BOTTOM - VOL_TOP);

  const ma5 = ma(prices, 5);
  const ma20 = ma(prices, 20);
  const ma60 = ma(prices, 60);

  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Helvetica, Arial, 'Microsoft JhengHei', sans-serif" font-size="12">`
  );
  parts.push(`<rect width="${W}" height="${H}" fill="#ffffff"/>`);
  parts.push(
    `<text x="${W / 2}" y="28" text-anchor="middle" font-size="18" font-weight="bold">${escapeText(opts.title)}</text>`
  );

  const gridStep = 5;
  for (let i = 0; i <= gridStep; i++) {
    const ratio = i / gridStep;
    const y = PRICE_TOP + ratio * (PRICE_BOTTOM - PRICE_TOP);
    const price = yMax - ratio * (yMax - yMin);
    parts.push(
      `<line x1="${PLOT_LEFT}" y1="${y}" x2="${PLOT_RIGHT}" y2="${y}" stroke="#eeeeee" />`
    );
    parts.push(
      `<text x="${PLOT_LEFT - 6}" y="${y + 4}" text-anchor="end" fill="#666">${price.toFixed(2)}</text>`
    );
  }

  for (const lvl of opts.levels) {
    if (lvl.price < yMin || lvl.price > yMax) continue;
    const y = yPrice(lvl.price);
    const color = lvl.type === "RESISTANCE" ? "#c0392b" : "#2980b9";
    const dash = lvl.strength === "STRONG" ? "none" : lvl.strength === "MEDIUM" ? "6,3" : "2,3";
    parts.push(
      `<line x1="${PLOT_LEFT}" y1="${y}" x2="${PLOT_RIGHT}" y2="${y}" stroke="${color}" stroke-width="1.2" stroke-dasharray="${dash}" opacity="0.85" />`
    );
    parts.push(
      `<text x="${PLOT_RIGHT + 4}" y="${y + 4}" fill="${color}" font-size="11">${lvl.type === "RESISTANCE" ? "壓" : "支"} ${lvl.price.toFixed(2)}</text>`
    );
  }

  for (let i = 0; i < prices.length; i++) {
    const p = prices[i];
    const x = xOf(i);
    const isUp = p.close >= p.open;
    const color = isUp ? "#d83933" : "#1f8a4f";
    const yOpen = yPrice(p.open);
    const yClose = yPrice(p.close);
    const yHigh = yPrice(p.high);
    const yLow = yPrice(p.low);
    const bodyTop = Math.min(yOpen, yClose);
    const bodyHeight = Math.max(Math.abs(yClose - yOpen), 1);

    parts.push(
      `<line x1="${x}" y1="${yHigh}" x2="${x}" y2="${yLow}" stroke="${color}" stroke-width="1" />`
    );
    parts.push(
      `<rect x="${x - candleWidth / 2}" y="${bodyTop}" width="${candleWidth}" height="${bodyHeight}" fill="${isUp ? color : "#ffffff"}" stroke="${color}" stroke-width="1" />`
    );

    const volColor = isUp ? "#d83939aa" : "#1f8a4faa";
    parts.push(
      `<rect x="${x - candleWidth / 2}" y="${yVol(p.volume)}" width="${candleWidth}" height="${VOL_BOTTOM - yVol(p.volume)}" fill="${volColor}" />`
    );
  }

  const drawMA = (series: (number | null)[], color: string, label: string) => {
    let path = "";
    for (let i = 0; i < series.length; i++) {
      const v = series[i];
      if (v === null) continue;
      const cmd = path === "" ? "M" : "L";
      path += `${cmd}${xOf(i).toFixed(1)},${yPrice(v).toFixed(1)} `;
    }
    if (path !== "") {
      parts.push(`<path d="${path.trim()}" stroke="${color}" stroke-width="1.4" fill="none" />`);
    }
  };
  drawMA(ma5, "#e67e22", "MA5");
  drawMA(ma20, "#8e44ad", "MA20");
  drawMA(ma60, "#2c3e50", "MA60");

  let lx = PLOT_LEFT + 10;
  const legendY = PRICE_TOP + 14;
  const legend: { color: string; label: string }[] = [
    { color: "#e67e22", label: "MA5" },
    { color: "#8e44ad", label: "MA20" },
    { color: "#2c3e50", label: "MA60" },
    { color: "#c0392b", label: "壓力" },
    { color: "#2980b9", label: "支撐" },
  ];
  for (const item of legend) {
    parts.push(
      `<rect x="${lx}" y="${legendY - 8}" width="14" height="3" fill="${item.color}" />`
    );
    parts.push(
      `<text x="${lx + 18}" y="${legendY - 2}" fill="#333">${escapeText(item.label)}</text>`
    );
    lx += 70;
  }

  parts.push(
    `<line x1="${PLOT_LEFT}" y1="${VOL_BOTTOM}" x2="${PLOT_RIGHT}" y2="${VOL_BOTTOM}" stroke="#333" />`
  );
  parts.push(
    `<text x="${PLOT_LEFT - 6}" y="${VOL_TOP + 4}" text-anchor="end" fill="#666">${Math.round(maxVolume)}</text>`
  );
  parts.push(
    `<text x="${PLOT_LEFT - 6}" y="${VOL_BOTTOM}" text-anchor="end" fill="#666">0</text>`
  );
  parts.push(
    `<text x="${PLOT_LEFT}" y="${VOL_TOP - 6}" fill="#444" font-size="11">成交量（張）</text>`
  );

  const tickStep = Math.max(1, Math.floor(prices.length / 8));
  for (let i = 0; i < prices.length; i += tickStep) {
    const x = xOf(i);
    parts.push(
      `<text x="${x}" y="${H - 12}" text-anchor="middle" fill="#666" font-size="10">${escapeText(prices[i].date.slice(5))}</text>`
    );
    parts.push(
      `<line x1="${x}" y1="${VOL_BOTTOM}" x2="${x}" y2="${VOL_BOTTOM + 4}" stroke="#666" />`
    );
  }

  parts.push(
    `<line x1="${PLOT_LEFT}" y1="${PRICE_TOP}" x2="${PLOT_LEFT}" y2="${PRICE_BOTTOM}" stroke="#333" />`
  );
  parts.push(
    `<line x1="${PLOT_LEFT}" y1="${PRICE_BOTTOM}" x2="${PLOT_RIGHT}" y2="${PRICE_BOTTOM}" stroke="#333" />`
  );

  parts.push("</svg>");
  return parts.join("\n");
}
