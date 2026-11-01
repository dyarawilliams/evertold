import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { z } from "zod";
import { validateBody } from "../../apps/api/src/http/validate.js";
import { withServer } from "./support.js";

const nameSchema = z.object({
  name: z.string().min(1),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validationApp() {
  const app = express();
  app.use(express.json());
  app.post("/echo", validateBody(nameSchema), (req, res) => {
    res.json({ name: req.body.name });
  });
  return app;
}

test("validateBody accepts a matching JSON body", async () => {
  await withServer(validationApp(), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/echo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Ada" }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { name: "Ada" });
  });
});

test("validateBody rejects an empty name", async () => {
  await withServer(validationApp(), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/echo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });
    const body: unknown = await response.json();

    assert.equal(response.status, 400);
    assert.equal(isRecord(body) && body.error, "invalid_request");
  });
});
