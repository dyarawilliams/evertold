import assert from "node:assert/strict";
import test from "node:test";
import { buildDemoInsights, DEMO_TRANSCRIPT } from "../../apps/api/src/stories/demo.js";
import { groundInsights } from "../../apps/api/src/stories/ground.js";

test("rejects a summary that adds a year", () => {
  const result = groundInsights(
    "We had soup.",
    {
      summary: "They married in 1954.",
      people: [],
      places: [],
      moments: [],
      topics: [],
      unknowns: [],
    },
    { source: "ollama", model: "gemma3", edited: false },
  );
  assert.equal(result.ok, false);
});

test("demo insights quote the synthetic transcript and name no model", () => {
  const insights = buildDemoInsights();
  assert.equal(insights.source, "demo");
  assert.equal(insights.model, null);
  assert.equal(insights.edited, false);
  for (const item of [
    ...insights.people,
    ...insights.places,
    ...insights.moments,
    ...insights.topics,
  ]) {
    assert.equal(DEMO_TRANSCRIPT.includes(item.excerpt), true);
  }
});
