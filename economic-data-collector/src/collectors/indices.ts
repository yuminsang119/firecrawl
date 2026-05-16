import YahooFinance from "yahoo-finance2";
import { pool } from "../db.js";
import { INDEX_SYMBOLS } from "../config.js";
import { logger } from "../lib/logger.js";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export async function collectIndices(): Promise<number> {
  const symbols = INDEX_SYMBOLS.map((s) => s.symbol);
  const quotes = await yf.quote(symbols);
  const list = Array.isArray(quotes) ? quotes : [quotes];
  const ts = new Date();

  const rows = list
    .filter((q) => typeof q.regularMarketPrice === "number")
    .map((q) => {
      const meta = INDEX_SYMBOLS.find((s) => s.symbol === q.symbol);
      return {
        ts,
        symbol: q.symbol,
        name: meta?.name ?? q.shortName ?? q.symbol,
        price: q.regularMarketPrice as number,
        change_pct: q.regularMarketChangePercent ?? null,
        volume: q.regularMarketVolume ?? null,
        source: "yahoo",
      };
    });

  if (rows.length === 0) {
    logger.warn("indices: no quotes returned");
    return 0;
  }

  const values: unknown[] = [];
  const placeholders: string[] = [];
  rows.forEach((r, i) => {
    const base = i * 7;
    placeholders.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`,
    );
    values.push(
      r.ts,
      r.symbol,
      r.name,
      r.price,
      r.change_pct,
      r.volume,
      r.source,
    );
  });

  await pool.query(
    `INSERT INTO market_indices (ts, symbol, name, price, change_pct, volume, source)
     VALUES ${placeholders.join(", ")}
     ON CONFLICT (symbol, ts) DO NOTHING`,
    values,
  );

  logger.info({ count: rows.length }, "indices: inserted");
  return rows.length;
}
