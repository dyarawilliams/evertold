import { createApp } from "./app.js";
import { openDatabase } from "./db/sqlite.js";
import { loadEnvironment } from "./env.js";

const env = loadEnvironment();
const database = openDatabase(env.databasePath);
const app = createApp({ env, database });

const server = app.listen(env.API_PORT, env.API_HOST, () => {
  console.log(`API listening on http://${env.API_HOST}:${env.API_PORT}`);
});

server.on("error", (error) => {
  console.error(error);
  database.close();
  process.exit(1);
});

function shutdown(): void {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
