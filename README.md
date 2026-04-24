# InvestmentToolAssistant

簡易股票分析小工具（TypeScript / CLI）。

整合下列六層分析並輸出 Markdown 報告：

1. 趨勢位置
2. K 線型態
3. 成交量
4. 法人籌碼（外資 / 投信 / 自營商 / 三大法人合計）
5. 基本面（營收、EPS、毛利率、營益率、淨利率、本益比、股淨比、殖利率）
6. 短 / 中 / 長線操作策略（含分批買進、分批賣出、停利、停損）

本工具不提供保證獲利訊號，目的是提供一套可重複使用的分析框架。

---

## 專案結構

```
src/
  types/
    stock.ts                 # 原始輸入資料型別
    analysis.ts              # 分析輸出型別
  analysis/
    candle.ts                # K 線實體 / 影線 / 訊號
    volume.ts                # 5 / 20 日均量、放量、量縮
    institutional.ts         # 外資 / 投信 / 自營、連買連賣、強買強賣
    fundamental.ts           # 營收、獲利、估值、股利、成長評分
    supportResistance.ts     # 支撐 / 壓力區
    trend.ts                 # 6 階段趨勢判斷
    strategy.ts              # 短 / 中 / 長線策略 + 分批買賣計畫
    report.ts                # Markdown 報告
  data/
    mockStockData.ts         # 產生 demo 用的 90 日 mock 資料
  index.ts                   # CLI 入口 + analyze() API
examples/
  sample-report.md           # 用 mock data 產生的範例報告
```

---

## 安裝

```bash
npm install
```

---

## 使用方式

### 1. 直接跑 mock data 並輸出到 stdout

```bash
npm run analyze
```

### 2. 存成 Markdown 檔

```bash
npx ts-node src/index.ts -o examples/sample-report.md
```

### 3. 抓真實資料（FinMind）

```bash
# 匿名速率
npx ts-node src/index.ts --fetch 2330 -o reports/2330.md

# 使用 FinMind token（高速率）
FINMIND_TOKEN=xxx npx ts-node src/index.ts --fetch 2330 -o reports/2330.md

# 指定截止日（回測用）
npx ts-node src/index.ts --fetch 2330 --as-of 2026-04-30 -o reports/2330.md
```

報告會輸出 `reports/2330.md`（內含 Mermaid 圖表 + 表格）和 `reports/assets/2330-candles.svg`（K 線 / 均線 / 支撐壓力疊圖），GitHub Markdown 直接可看。

### 4. 用自己的 JSON 資料

```bash
npx ts-node src/index.ts -i my-stock.json -o my-report.md
```

`my-stock.json` 需符合 `AnalysisInput`：

```ts
{
  "stockId": "2330",
  "stockName": "台積電",
  "prices": [
    { "date": "2026-01-05", "open": 180, "high": 182, "low": 178, "close": 181, "volume": 9000 }
  ],
  "institutionalTrades": [
    { "date": "2026-01-05", "foreignInvestor": 500, "investmentTrust": 80, "dealer": -20, "total": 560 }
  ],
  "fundamentals": {
    "stockId": "2330",
    "stockName": "台積電",
    "monthlyRevenueYoY": 22.5,
    "epsTTM": 45.8,
    "grossMargin": 53.2,
    "peRatio": 18.5,
    "dividendYield": 2.1
  },
  "analysisDate": "2026-04-24",
  "lookbackDays": 60
}
```

### 5. 作為 library 使用

```ts
import { analyze } from "./src";
import { buildReport } from "./src/analysis/report";
import { buildMockInput } from "./src/data/mockStockData";

const bundle = analyze(buildMockInput());
console.log(buildReport(bundle));
```

---

## 建置

```bash
npm run build     # 編譯到 dist/
npm run clean     # 清掉 dist/
```

---

## 核心分析邏輯（一句話版）

```txt
支撐不破 + 量縮或長下影 + 法人賣壓縮小 + 基本面沒壞 = 可分批買。
高檔長上影 + 爆量 + 法人賣超 = 分批停利。
跌破關鍵支撐 + 放量 + 法人續賣 = 減碼或撤退。
基本面轉弱 = 不攤平，重新評估。
```

---

## 範例報告

用內建 mock data 可立即產出一份範例：

```bash
npx ts-node src/index.ts -o examples/sample-report.md
```

輸出內容見 [`examples/sample-report.md`](examples/sample-report.md)。

---

## 每日排程（GitHub Actions）

`.github/workflows/daily-analysis.yml` 已內建：

- 每個工作日 18:00（台北時間）自動跑
- 也可以手動 `Run workflow` 並指定股票代號
- 抓 FinMind 真實資料 → 產報告 + SVG 圖 → commit 到 `reports/YYYY-MM-DD/` → 開一個 Issue 貼總結

設定步驟：

1. 進 repo → Settings → Actions → 確認 workflows 已開
2. （選用）Settings → Secrets → 新增 `FINMIND_TOKEN`，提高 API 速率
3. （選用 AI 摘要）Settings → Variables → 新增 `ENABLE_AI_SUMMARY=true`，並在 Secrets 加 `ANTHROPIC_API_KEY`，workflow 會多跑一個 job 讓 Claude 寫白話摘要

要分析多支：手動觸發時在 `stock_ids` 欄位填 `2330,2317,0050`。

## 後續擴充

- 把 `analyze()` 包成 HTTP / tRPC endpoint，串接前端儀表板
- 擴充至 React / Next.js / Expo App 的股票分析儀表板
- 將 SVG 改成互動式 Plotly / Lightweight Charts
