import { groundInsights } from "./ground.js";
import type { Insights } from "./types.js";

export const DEMO_TITLE = "Synthetic demo story";

export const DEMO_TRANSCRIPT = [
  "This is a synthetic demonstration story, not a real family recording.",
  "My name in this demo is Sample Narrator.",
  "We lived near Demo Creek.",
  "The important moment was the day the paper boat made it across the creek.",
  "No real people are described here.",
].join(" ");

const DEMO_SUMMARY =
  "Synthetic demonstration only. Sample Narrator mentions living near Demo Creek and a paper boat crossing that creek. This text was written for the demo and was not produced by Gemma or Whisper.";

export function buildDemoInsights(): Insights {
  const grounded = groundInsights(
    DEMO_TRANSCRIPT,
    {
      summary: DEMO_SUMMARY,
      people: [
        {
          label: "Sample Narrator",
          excerpt: "My name in this demo is Sample Narrator.",
        },
      ],
      places: [
        {
          label: "Demo Creek",
          excerpt: "We lived near Demo Creek.",
        },
      ],
      moments: [
        {
          label: "A paper boat crossed the creek",
          excerpt: "The important moment was the day the paper boat made it across the creek.",
        },
      ],
      topics: [
        {
          label: "synthetic demonstration",
          excerpt: "This is a synthetic demonstration story, not a real family recording.",
        },
      ],
      unknowns: [
        "Dates, relationships, and historical events are unknown because this story is synthetic.",
      ],
    },
    { source: "demo", model: null, edited: false },
  );

  if (!grounded.ok || grounded.removed !== 0) {
    throw new Error("Synthetic demo insights must quote the synthetic transcript.");
  }
  return grounded.insights;
}
