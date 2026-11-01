import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import { createApp, getDatabase } from "../../apps/api/src/app.js";
import { openDatabase } from "../../apps/api/src/db/sqlite.js";
import { errorHandler } from "../../apps/api/src/http/errors.js";
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
      assert.deepEqual(await response.json(), {
        error: "not_found",
        message: "No API route matched this request.",
      });
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
      assert.deepEqual(await response.json(), {
        error: "invalid_json",
        message: "The request body was not valid JSON.",
      });
    });
  } finally {
    database.close();
  }
});

test("unexpected errors include a message and hide the cause", () => {
  let statusCode = 0;
  let payload: unknown;
  const response = {
    headersSent: false,
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      payload = body;
    },
  } as unknown as Response;
  const logged: unknown[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    logged.push(args);
  };

  try {
    errorHandler(
      new Error("sqlite path /tmp/secret.sqlite"),
      {} as Request,
      response,
      (() => {
        assert.fail("next was called");
      }) as NextFunction,
    );
  } finally {
    console.error = originalError;
  }

  assert.equal(logged.length, 1);

  assert.equal(statusCode, 500);
  assert.deepEqual(payload, {
    error: "internal_error",
    message: "The API could not finish that request.",
  });
  assert.equal(JSON.stringify(payload).includes("secret"), false);
});
