import pg from "pg";
import { config } from "./config.js";

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 5,
});

export async function ping(): Promise<void> {
  await pool.query("SELECT 1");
}

export async function shutdown(): Promise<void> {
  await pool.end();
}
