import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createAppServer } from "./app.ts";

export { createAppServer, createDashboardService } from "./app.ts";

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const host = process.env.HOST ?? "127.0.0.1";
  const port = Number(process.env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT must be an integer from 1 to 65535.");
  const server = createAppServer();
  server.listen(port, host, () => {
    console.log(`Zcash observatory available at http://${host}:${port}`);
  });
  server.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
