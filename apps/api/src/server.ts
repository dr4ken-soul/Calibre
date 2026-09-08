/**
 * Calibre API server entry point.
 */

import { resolveAdapter } from "@calibre/dreamdex-adapter";
import { loadConfig } from "./config.js";
import { JsonFileStore } from "./storage.js";
import { createApp } from "./app.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const { adapter } = resolveAdapter({ liveBaseUrl: config.dreamdexApiUrl ?? undefined });
  const store = new JsonFileStore(config.dataDir);
  const { app, poller } = createApp({ adapter, store, config, now: () => Date.now() });

  poller.start();
  const server = app.listen(config.port, () => {
    console.log(`Calibre API listening on port ${config.port}`);
    console.log(`Market source: ${adapter.sourceLabel}`);
    console.log(`AI assist: ${config.ai ? "enabled" : "disabled, deterministic only"}`);
  });

  const shutdown = async () => {
    poller.stop();
    server.close();
    await store.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((error) => {
  console.error("Failed to start Calibre API", error);
  process.exit(1);
});
