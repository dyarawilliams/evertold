import assert from "node:assert/strict";
import test from "node:test";
import { createApp, getDatabase } from "../../apps/api/src/app.js";
import { openDatabase } from "../../apps/api/src/db/sqlite.js";
import { withServer } from "./support.js";

const origin = "http://127.0.0.1:5173";

test("GET /health reports the API and hides filesystem details", async () => {
  const database = openDatabase(":memory:");
  const app = createApp({
    env: { WEB_ORIGIN: origin },
    database,
  });

  try {
    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health`, {
        headers: { Origin: origin },
      });
      const body: unknown = await response.json();

      assert.equal(response.status, 200);
      assert.deepEqual(body, { status: "ok", service: "api" });
      assert.equal(response.headers.get("access-control-allow-origin"), origin);

      const proxied = await fetch(`${baseUrl}/api/health`);
      assert.equal(proxied.status, 200);
      assert.deepEqual(await proxied.json(), { status: "ok", service: "api" });
      assert.equal(getDatabase(app).pragma("foreign_keys", { simple: true }), 1);
      assert.equal(JSON.stringify(body).includes(":memory:"), false);
    });
  } finally {
    database.close();
  }
});

test("unknown routes return not_found", async () => {
  const database = openDatabase(":memory:");
  const app = createApp({
    env: { WEB_ORIGIN: origin },
    database,
  });

  try {
    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/stories`);
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: "not_found" });
    });
  } finally {
    database.close();
  }
});

test("malformed JSON is rejected", async () => {
  const database = openDatabase(":memory:");
  const app = createApp({
    env: { WEB_ORIGIN: origin },
    database,
  });

  try {
    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      });
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: "invalid_json" });
    });
  } finally {
    database.close();
  }
});
