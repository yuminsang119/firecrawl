import { pool } from "../db.js";
import { config } from "../config.js";
import { logger } from "./logger.js";

const lastSent = new Map<string, number>();

export interface AlertCandidate {
  kind: "fx" | "index";
  symbol: string;
  display: string;
  price: number;
  changePct: number | null;
}

function shouldAlert(c: AlertCandidate): boolean {
  if (c.changePct === null || !Number.isFinite(c.changePct)) return false;
  const threshold = c.kind === "fx" ? config.ALERT_FX_PCT : config.ALERT_INDEX_PCT;
  if (Math.abs(c.changePct) < threshold) return false;
  const key = `${c.kind}:${c.symbol}`;
  const last = lastSent.get(key) ?? 0;
  const cooldownMs = config.ALERT_COOLDOWN_MIN * 60 * 1000;
  if (Date.now() - last < cooldownMs) return false;
  return true;
}

async function postToSlack(message: string): Promise<void> {
  if (!config.SLACK_WEBHOOK_URL) return;
  const res = await fetch(config.SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: message }),
  });
  if (!res.ok) {
    throw new Error(`Slack webhook HTTP ${res.status}`);
  }
}

export async function maybeAlert(candidates: AlertCandidate[]): Promise<void> {
  if (!config.SLACK_WEBHOOK_URL) return;
  const fired = candidates.filter(shouldAlert);
  if (fired.length === 0) return;

  for (const c of fired) {
    const dir = (c.changePct ?? 0) >= 0 ? "▲" : "▼";
    const pct = (c.changePct ?? 0).toFixed(2);
    const msg = `${dir} *${c.display}* ${c.price.toLocaleString()} (${pct}%)`;
    try {
      await postToSlack(msg);
      lastSent.set(`${c.kind}:${c.symbol}`, Date.now());
      await pool.query(
        `INSERT INTO alerts_sent (kind, symbol, change_pct, price, message)
         VALUES ($1, $2, $3, $4, $5)`,
        [c.kind, c.symbol, c.changePct, c.price, msg],
      );
      logger.info({ symbol: c.symbol, pct }, "alert sent");
    } catch (err) {
      logger.error({ err, symbol: c.symbol }, "alert failed");
    }
  }
}
