import assert from "node:assert/strict";
import test from "node:test";
import { apiProxyTarget } from "../../apps/web/vite.config.js";

test("the dev proxy target ignores a trailing slash and /api suffix", () => {
  assert.equal(apiProxyTarget(undefined), "http://127.0.0.1:3001");
  assert.equal(apiProxyTarget("  "), "http://127.0.0.1:3001");
  assert.equal(apiProxyTarget("http://127.0.0.1:3001"), "http://127.0.0.1:3001");
  assert.equal(apiProxyTarget("http://127.0.0.1:3001/"), "http://127.0.0.1:3001");
  assert.equal(apiProxyTarget("http://127.0.0.1:3001/api"), "http://127.0.0.1:3001");
  assert.equal(apiProxyTarget("http://127.0.0.1:3001/api/"), "http://127.0.0.1:3001");
  assert.equal(apiProxyTarget("http://127.0.0.1:3001/api/extra"), "http://127.0.0.1:3001/api/extra");
});
