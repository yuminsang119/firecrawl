import YahooFinance from "yahoo-finance2";
import { pool } from "../db.js";
import { FX_SYMBOLS } from "../config.js";
import { logger } from "../lib/logger.js";
import { maybeAlert, type AlertCandidate } from "../lib/alerts.js";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export async function collectFx(): Promise<number> {
  const symbols = FX_SYMBOLS.map((s) => s.symbol);
  const quotes = await yf.quote(symbols);
  const list = Array.isArray(quotes) ? quotes : [quotes];
  const ts = new Date();

  const rows = list
    .filter((q) => typeof q.regularMarketPrice === "number")
    .map((q) => {
      const meta = FX_SYMBOLS.find((s) => s.symbol === q.symbol);
      return {
        ts,
        symbol: meta?.label ?? q.symbol,
        price: q.regularMarketPrice as number,
        change_pct: q.regularMarketChangePercent ?? null,
        source: "yahoo",
      };
    });

  if (rows.length === 0) {
    logger.warn("fx: no quotes returned");
    return 0;
  }

  const values: unknown[] = [];
  const placeholders: string[] = [];
  rows.forEach((r, i) => {
    const base = i * 5;
    placeholders.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`,
    );
    values.push(r.ts, r.symbol, r.price, r.change_pct, r.source);
  });

  await pool.query(
    `INSERT INTO fx_rates (ts, symbol, price, change_pct, source)
     VALUES ${placeholders.join(", ")}
     ON CONFLICT (symbol, ts) DO NOTHING`,
    values,
  );

  const candidates: AlertCandidate[] = rows.map((r) => ({
    kind: "fx",
    symbol: r.symbol,
    display: r.symbol,
    price: r.price,
    changePct: r.change_pct,
  }));
  await maybeAlert(candidates);

  logger.info({ count: rows.length }, "fx: inserted");
  return rows.length;
}
