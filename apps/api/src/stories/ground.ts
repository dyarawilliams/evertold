import { insightsSchema, type InsightItem, type Insights, type InsightSource } from "./types.js";

export const REMOVED_NOTE =
  "Some suggestions were removed because their excerpts were not in the transcript.";

const YEAR = /\b(?:1[0-9]{3}|20[0-9]{2})\b/g;

export type InsightDraft = {
  summary: string;
  people: InsightItem[];
  places: InsightItem[];
  moments: InsightItem[];
  topics: InsightItem[];
  unknowns: string[];
};

export type GroundResult =
  | { ok: true; insights: Insights; removed: number }
  | { ok: false; message: string };

export function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function excerptIsVerbatim(excerpt: string, transcript: string): boolean {
  const needle = normalizeText(excerpt);
  if (needle.length < 2) {
    return false;
  }
  return normalizeText(transcript).includes(needle);
}

export function groundInsights(
  transcript: string,
  draft: InsightDraft,
  meta: { source: InsightSource; model: string | null; edited: boolean },
): GroundResult {
  const summary = draft.summary.trim().slice(0, 4_000);
  if (!summary) {
    return {
      ok: false,
      message: "No summary was saved because the response did not include one.",
    };
  }
  if (hasUnsupportedYear(summary, transcript)) {
    return {
      ok: false,
      message: "No insights were saved because the summary included a year that is not in the transcript.",
    };
  }

  let removed = 0;
  const people = keepNamed(draft.people, transcript);
  removed += draft.people.length - people.length;
  const places = keepNamed(draft.places, transcript);
  removed += draft.places.length - places.length;
  const moments = keepQuoted(draft.moments, transcript);
  removed += draft.moments.length - moments.length;
  const topics = keepQuoted(draft.topics, transcript);
  removed += draft.topics.length - topics.length;

  const unknowns = draft.unknowns
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && !hasUnsupportedYear(item, transcript));
  if (removed > 0) {
    unknowns.push(REMOVED_NOTE);
  }

  const candidate = {
    source: meta.source,
    model: meta.model,
    edited: meta.edited,
    summary,
    people,
    places,
    moments,
    topics,
    unknowns: unique(unknowns).slice(0, 20),
  };
  const parsed = insightsSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      message: "No insights were saved because the response was not usable.",
    };
  }
  return { ok: true, insights: parsed.data, removed };
}

function keepNamed(items: InsightItem[], transcript: string): InsightItem[] {
  return items.filter((item) => {
    if (hasUnsupportedYear(item.label, transcript) || hasUnsupportedYear(item.excerpt, transcript)) {
      return false;
    }
    if (!excerptIsVerbatim(item.excerpt, transcript)) {
      return false;
    }
    return labelInExcerpt(item.label, item.excerpt);
  });
}

function keepQuoted(items: InsightItem[], transcript: string): InsightItem[] {
  return items.filter((item) => {
    if (hasUnsupportedYear(item.label, transcript) || hasUnsupportedYear(item.excerpt, transcript)) {
      return false;
    }
    return excerptIsVerbatim(item.excerpt, transcript);
  });
}

function labelInExcerpt(label: string, excerpt: string): boolean {
  const name = normalizeText(label);
  if (name === "unknown") {
    return true;
  }
  return name.length > 0 && normalizeText(excerpt).includes(name);
}

function hasUnsupportedYear(value: string, transcript: string): boolean {
  const years = value.match(YEAR) ?? [];
  return years.some((year) => !transcript.includes(year));
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }
  return result;
}
