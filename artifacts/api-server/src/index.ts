import "dotenv/config";
import app from "./app";
import { logger } from "./lib/logger";
import { startBackgroundSync } from "./lib/ovg-sync";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Start OVG background sync (disabled in dev for testing)
if (process.env.NODE_ENV !== "development") {
  startBackgroundSync();
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
