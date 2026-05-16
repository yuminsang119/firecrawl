import FirecrawlApp from "@mendable/firecrawl-js";
import { pool } from "../db.js";
import { config, NEWS_QUERIES } from "../config.js";
import { logger } from "../lib/logger.js";

let appInstance: FirecrawlApp | null = null;
function getApp(): FirecrawlApp {
  if (!config.FIRECRAWL_API_KEY) {
    throw new Error("FIRECRAWL_API_KEY is required for news collector");
  }
  if (!appInstance) {
    appInstance = new FirecrawlApp({
      apiKey: config.FIRECRAWL_API_KEY,
      apiUrl: config.FIRECRAWL_API_URL,
    });
  }
  return appInstance;
}

interface NewsRow {
  ts: Date;
  url: string;
  title: string;
  summary: string | null;
  source: string | null;
  region: string;
  query: string;
}

function deriveSource(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export async function collectNews(): Promise<number> {
  const app = getApp();
  const ts = new Date();
  const rows: NewsRow[] = [];

  for (const q of NEWS_QUERIES) {
    try {
      const res = await app.search(q.query, { limit: 5 });
      const items = res.data ?? [];
      for (const item of items) {
        const url = item.url ?? item.metadata?.sourceURL;
        const title = item.metadata?.title ?? item.metadata?.ogTitle;
        if (!url || !title) continue;
        rows.push({
          ts,
          url,
          title,
          summary:
            item.metadata?.description ?? item.metadata?.ogDescription ?? null,
          source: deriveSource(url),
          region: q.region,
          query: q.query,
        });
      }
    } catch (err) {
      logger.error({ err, query: q.query }, "news: search failed");
    }
  }

  if (rows.length === 0) {
    logger.warn("news: no items collected");
    return 0;
  }

  const values: unknown[] = [];
  const placeholders: string[] = [];
  rows.forEach((r, i) => {
    const base = i * 7;
    placeholders.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`,
    );
    values.push(r.ts, r.url, r.title, r.summary, r.source, r.region, r.query);
  });

  await pool.query(
    `INSERT INTO economic_news (ts, url, title, summary, source, region, query)
     VALUES ${placeholders.join(", ")}
     ON CONFLICT (url, ts) DO NOTHING`,
    values,
  );

  logger.info({ count: rows.length }, "news: inserted");
  return rows.length;
}
