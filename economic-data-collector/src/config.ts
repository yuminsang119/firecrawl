import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  FIRECRAWL_API_KEY: z.string().optional(),
  FIRECRAWL_API_URL: z.string().url().default("https://api.firecrawl.dev"),
  LOG_LEVEL: z.string().default("info"),
  TZ: z.string().default("Asia/Seoul"),
  FX_CRON: z.string().default("*/1 * * * *"),
  INDICES_CRON: z.string().default("*/5 * * * *"),
  NEWS_CRON: z.string().default("0 * * * *"),
});

export const config = schema.parse(process.env);

export const FX_SYMBOLS = [
  { symbol: "KRW=X", label: "USD/KRW" },
  { symbol: "EURUSD=X", label: "EUR/USD" },
  { symbol: "JPY=X", label: "USD/JPY" },
  { symbol: "CNY=X", label: "USD/CNY" },
  { symbol: "GC=F", label: "Gold (XAU)" },
  { symbol: "CL=F", label: "WTI Crude" },
];

export const INDEX_SYMBOLS = [
  { symbol: "^KS11", name: "KOSPI" },
  { symbol: "^KQ11", name: "KOSDAQ" },
  { symbol: "^GSPC", name: "S&P 500" },
  { symbol: "^IXIC", name: "NASDAQ Composite" },
  { symbol: "^DJI", name: "Dow Jones" },
  { symbol: "^N225", name: "Nikkei 225" },
  { symbol: "^HSI", name: "Hang Seng" },
  { symbol: "^STOXX50E", name: "Euro Stoxx 50" },
];

export const NEWS_QUERIES = [
  { query: "한국 경제 뉴스 오늘", region: "KR" },
  { query: "코스피 시황", region: "KR" },
  { query: "원달러 환율", region: "KR" },
  { query: "global economy headlines today", region: "GLOBAL" },
  { query: "federal reserve interest rate", region: "US" },
];
