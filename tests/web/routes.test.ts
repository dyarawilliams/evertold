import assert from "node:assert/strict";
import test from "node:test";
import { hrefFor, parseRoute } from "../../apps/web/src/lib/routes.js";

test("routes the story workflow", () => {
  assert.deepEqual(parseRoute("/", ""), { name: "dashboard" });
  assert.deepEqual(parseRoute("/record", ""), { name: "record", mode: "record" });
  assert.deepEqual(parseRoute("/record", "?mode=upload"), { name: "record", mode: "upload" });
  assert.deepEqual(parseRoute("/record", "?mode=write"), { name: "record", mode: "write" });
  assert.deepEqual(parseRoute("/library", ""), { name: "library" });
  assert.deepEqual(parseRoute("/stories/abc%20def", ""), { name: "story", id: "abc def" });
  assert.deepEqual(parseRoute("/missing", ""), { name: "not-found" });
  assert.equal(hrefFor({ name: "story", id: "a b" }), "/stories/a%20b");
  assert.equal(hrefFor({ name: "record", mode: "upload" }), "/record?mode=upload");
});
