import assert from "node:assert/strict";
import test from "node:test";
import { EverToldDatabase } from "../../apps/web/src/db/index.js";

test("names the browser database evertold", () => {
  const database = new EverToldDatabase();
  assert.equal(database.name, "evertold");
  database.close();
});
