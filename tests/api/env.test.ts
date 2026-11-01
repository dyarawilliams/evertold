import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { findRepoRoot, parseEnv } from "../../apps/api/src/env.js";

test("resolves configuration from defaults and ai/gemma/model.json", () => {
  const repoRoot = findRepoRoot(process.cwd());
  const env = parseEnv({}, repoRoot);

  assert.equal(env.API_HOST, "127.0.0.1");
  assert.equal(env.API_PORT, 3001);
  assert.equal(env.WEB_ORIGIN, "http://127.0.0.1:5173");
  assert.equal(env.TRANSCRIPTION_URL, "http://127.0.0.1:8000");
  assert.equal(env.OLLAMA_BASE_URL, "http://127.0.0.1:11434");
  assert.equal(env.OLLAMA_MODEL, "gemma3");
  assert.equal(env.databasePath, path.join(repoRoot, "data", "evertold.sqlite"));
});

test("keeps an absolute database path and an explicit model", () => {
  const repoRoot = findRepoRoot(process.cwd());
  const env = parseEnv(
    {
      DATABASE_PATH: "/tmp/evertold.sqlite",
      OLLAMA_MODEL: "gemma3:latest",
    },
    repoRoot,
  );

  assert.equal(env.databasePath, "/tmp/evertold.sqlite");
  assert.equal(env.OLLAMA_MODEL, "gemma3:latest");
});

test("rejects an invalid API port", () => {
  const repoRoot = findRepoRoot(process.cwd());
  assert.throws(() => parseEnv({ API_PORT: "0" }, repoRoot));
});
