import { pool } from "../db.js";
import { config, ECOS_SERIES, type EcosSeries } from "../config.js";
import { logger } from "../lib/logger.js";

interface EcosRow {
  STAT_CODE: string;
  STAT_NAME: string;
  ITEM_CODE1: string;
  ITEM_NAME1?: string;
  UNIT_NAME?: string;
  TIME: string;
  DATA_VALUE: string;
}

interface EcosResponse {
  StatisticSearch?: {
    list_total_count: number;
    row: EcosRow[];
  };
  RESULT?: { CODE: string; MESSAGE: string };
}

function startDateForCycle(cycle: EcosSeries["cycle"]): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  switch (cycle) {
    case "D": {
      const past = new Date(now);
      past.setUTCDate(past.getUTCDate() - 30);
      return (
        past.getUTCFullYear().toString() +
        String(past.getUTCMonth() + 1).padStart(2, "0") +
        String(past.getUTCDate()).padStart(2, "0")
      );
    }
    case "M":
      return `${yyyy - 1}${mm}`;
    case "Q": {
      const q = Math.floor(now.getUTCMonth() / 3) + 1;
      return `${yyyy - 1}Q${q}`;
    }
    case "Y":
      return `${yyyy - 5}`;
    default:
      return `${yyyy}${mm}${dd}`;
  }
}

function endDateForCycle(cycle: EcosSeries["cycle"]): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  switch (cycle) {
    case "D":
      return `${yyyy}${mm}${dd}`;
    case "M":
      return `${yyyy}${mm}`;
    case "Q":
      return `${yyyy}Q${Math.floor(now.getUTCMonth() / 3) + 1}`;
    case "Y":
      return `${yyyy}`;
    default:
      return `${yyyy}${mm}${dd}`;
  }
}

function periodToDate(period: string, cycle: EcosSeries["cycle"]): Date {
  switch (cycle) {
    case "D":
      return new Date(
        Date.UTC(
          Number(period.slice(0, 4)),
          Number(period.slice(4, 6)) - 1,
          Number(period.slice(6, 8)),
        ),
      );
    case "M":
      return new Date(
        Date.UTC(Number(period.slice(0, 4)), Number(period.slice(4, 6)) - 1, 1),
      );
    case "Q": {
      const year = Number(period.slice(0, 4));
      const q = Number(period.slice(-1));
      return new Date(Date.UTC(year, (q - 1) * 3, 1));
    }
    case "Y":
      return new Date(Date.UTC(Number(period), 0, 1));
  }
}

async function fetchSeries(series: EcosSeries): Promise<EcosRow[]> {
  if (!config.ECOS_API_KEY) {
    throw new Error("ECOS_API_KEY is required for macro collector");
  }
  const start = startDateForCycle(series.cycle);
  const end = endDateForCycle(series.cycle);
  const parts = [
    config.ECOS_API_URL,
    "StatisticSearch",
    config.ECOS_API_KEY,
    "json",
    "kr",
    "1",
    "100",
    series.statCode,
    series.cycle,
    start,
    end,
    series.itemCode1,
  ];
  if (series.itemCode2) parts.push(series.itemCode2);
  const url = parts.join("/");

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ECOS HTTP ${res.status}`);
  }
  const json = (await res.json()) as EcosResponse;
  if (json.RESULT && json.RESULT.CODE !== "INFO-000") {
    throw new Error(`ECOS error ${json.RESULT.CODE}: ${json.RESULT.MESSAGE}`);
  }
  return json.StatisticSearch?.row ?? [];
}

export async function collectMacro(): Promise<number> {
  if (!config.ECOS_API_KEY) {
    logger.warn("macro: ECOS_API_KEY not set, skipping");
    return 0;
  }

  let inserted = 0;
  for (const series of ECOS_SERIES) {
    try {
      const rows = await fetchSeries(series);
      if (rows.length === 0) {
        logger.warn({ series: series.id }, "macro: empty");
        continue;
      }
      const values: unknown[] = [];
      const placeholders: string[] = [];
      rows.forEach((r, i) => {
        const base = i * 9;
        placeholders.push(
          `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`,
        );
        const value = Number(r.DATA_VALUE);
        values.push(
          periodToDate(r.TIME, series.cycle),
          series.id,
          series.name,
          Number.isFinite(value) ? value : null,
          r.TIME,
          series.cycle,
          r.UNIT_NAME ?? null,
          "KR",
          "ecos",
        );
      });

      const result = await pool.query(
        `INSERT INTO macro_indicators
           (ts, series_id, name, value, period, cycle, unit, region, source)
         VALUES ${placeholders.join(", ")}
         ON CONFLICT (series_id, ts) DO NOTHING`,
        values,
      );
      inserted += result.rowCount ?? 0;
      logger.info(
        { series: series.id, fetched: rows.length, inserted: result.rowCount },
        "macro: upserted",
      );
    } catch (err) {
      logger.error({ err, series: series.id }, "macro: series failed");
    }
  }
  return inserted;
}
