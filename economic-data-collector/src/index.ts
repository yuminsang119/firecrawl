import cron from "node-cron";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";
import { ping, shutdown } from "./db.js";
import { collectFx } from "./collectors/fx.js";
import { collectIndices } from "./collectors/indices.js";
import { collectNews } from "./collectors/news.js";

type Job = { name: string; cron: string; run: () => Promise<number> };

const jobs: Job[] = [
  { name: "fx", cron: config.FX_CRON, run: collectFx },
  { name: "indices", cron: config.INDICES_CRON, run: collectIndices },
  { name: "news", cron: config.NEWS_CRON, run: collectNews },
];

async function runOnce(): Promise<void> {
  for (const job of jobs) {
    try {
      const n = await job.run();
      logger.info({ job: job.name, rows: n }, "job done");
    } catch (err) {
      logger.error({ err, job: job.name }, "job failed");
    }
  }
}

async function main(): Promise<void> {
  await ping();
  logger.info("db: connected");

  if (process.argv.includes("--once")) {
    await runOnce();
    await shutdown();
    return;
  }

  for (const job of jobs) {
    cron.schedule(
      job.cron,
      async () => {
        const start = Date.now();
        try {
          const n = await job.run();
          logger.info(
            { job: job.name, rows: n, ms: Date.now() - start },
            "job tick",
          );
        } catch (err) {
          logger.error({ err, job: job.name }, "job tick failed");
        }
      },
      { timezone: config.TZ },
    );
    logger.info({ job: job.name, cron: job.cron }, "scheduled");
  }

  process.on("SIGINT", async () => {
    logger.info("shutting down");
    await shutdown();
    process.exit(0);
  });
}

main().catch((err) => {
  logger.error({ err }, "fatal");
  process.exit(1);
});
