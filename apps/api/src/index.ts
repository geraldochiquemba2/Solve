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

// Módulo ginásio (OVG): DESLIGADO por defeito na fase Cademi-CRM (cota Neon mensal).
// Ligar só quando o ginásio entrar: ENABLE_OVG_SYNC=true
if (process.env.ENABLE_OVG_SYNC === "true") {
  startBackgroundSync();
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
